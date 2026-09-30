-- Unshipped-order timeout, abandoned layaway, stock back on refund, rate limits.

-- 1. Know whether an order has taken stock, so it is taken once and
--    put back once (refund / cancellation).
alter table public.orders add column if not exists stock_taken boolean not null default false;
alter table public.orders add column if not exists ship_reminded_at timestamptz;
update public.orders set stock_taken = true
where stock_taken = false
  and (
    (coalesce(payment_plan, 'full') <> 'layaway' and status in ('paid_held', 'shipped', 'completed', 'disputed'))
    or (payment_plan = 'layaway' and exists (
      select 1 from public.layaway_installments i
      where i.order_id = orders.id and i.installment_number = 1 and i.status = 'paid'))
  );

alter table public.layaway_installments add column if not exists reminded_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'new_order', 'dispute_filed', 'low_stock', 'payout_released', 'offer', 'signature', 'ship_reminder', 'order_cancelled'
]));

do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.stock_movements'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reason%';
  if c is not null then execute format('alter table public.stock_movements drop constraint %I', c); end if;
end $$;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason = any (array['restock', 'shop_sale', 'sale_undone', 'correction', 'order_refunded']));

-- Claim the right to take stock for an order (true only the first time).
create or replace function public.claim_stock_take(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update orders set stock_taken = true where id = p_order and stock_taken = false;
  return found;
end $$;
revoke execute on function public.claim_stock_take(uuid) from public, anon, authenticated;

-- Put an order's items back on the shelf (only if it had taken them).
create or replace function public.put_back_stock(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  update orders set stock_taken = false where id = p_order and stock_taken = true;
  if not found then return 0; end if;
  for r in select product_id, quantity, shop_id from order_items oi join orders o on o.id = oi.order_id where oi.order_id = p_order and product_id is not null loop
    update products set stock_quantity = stock_quantity + r.quantity where id = r.product_id;
    insert into stock_movements (shop_id, product_id, change, reason) values (r.shop_id, r.product_id, r.quantity, 'order_refunded');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function public.put_back_stock(uuid) from public, anon, authenticated;

-- 2. Rate limits (fixed window per key), used by the server only.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
