-- Migration 029
-- 1. Security: columns a shop owner, buyer or seller must never set
--    themselves (verification, admin role, order status) are now
--    protected in the database, not only in the app.
-- 2. Finer condition grades + how long the seller owned the item.
-- 3. Offers ("Make an offer") with private auto-accept / floor settings.
-- 4. Shared bags ("Ask someone to pay") and the order links for both.
-- 5. Daily product views + popularity scores for "Trending" shelves.
-- 6. Shop books: walk-in sales, restocks, expenses, private cost prices.
-- 7. Signature shops (known brands, designers, creators, makers).

-- ---------------------------------------------------------------
-- 1. Security
-- ---------------------------------------------------------------

-- Orders are only ever written by the server (checkout, webhooks,
-- seller/buyer API routes use the service role). These two policies
-- let a signed-in user insert an order as already "paid" or let a
-- seller mark their own order completed straight through the API.
drop policy if exists "Buyers create their own orders" on orders;
drop policy if exists "Sellers update orders on their shop" on orders;

create or replace function public.is_service_request() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin');
$$;

-- profiles.role decides who is an admin: only the server may change it.
create or replace function public.protect_profile_role() returns trigger
language plpgsql as $$
begin
  if public.is_service_request() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role not in ('buyer', 'seller') then new.role := 'buyer'; end if;
  elsif new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on profiles;
create trigger protect_profile_role before insert or update on profiles
  for each row execute function public.protect_profile_role();

-- Verification, view counts and Signature status are decided by the
-- server/admin, never by the shop owner's own update.
alter table shops add column if not exists signature_status text not null default 'none'
  check (signature_status in ('none', 'pending', 'approved', 'rejected'));
alter table shops add column if not exists signature_kind text
  check (signature_kind in ('brand', 'designer', 'creator', 'maker', 'boutique'));
alter table shops add column if not exists signature_story text check (char_length(signature_story) <= 1200);
alter table shops add column if not exists signature_founder text check (char_length(signature_founder) <= 80);
alter table shops add column if not exists signature_founded_year smallint check (signature_founded_year between 1900 and 2100);
alter table shops add column if not exists signature_audience text check (char_length(signature_audience) <= 120);
alter table shops add column if not exists signature_proof_url text check (char_length(signature_proof_url) <= 300);
alter table shops add column if not exists made_in_cameroon boolean not null default false;
alter table shops add column if not exists signature_applied_at timestamptz;
alter table shops add column if not exists signature_reviewed_at timestamptz;
alter table shops add column if not exists signature_note text;

create or replace function public.protect_shop_columns() returns trigger
language plpgsql as $$
begin
  if public.is_service_request() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.identity_verification_status := 'none';
    new.identity_verification_session_id := null;
    new.identity_verified_at := null;
    new.verification_rejected_reason := null;
    new.view_count := 0;
    new.signature_status := 'none';
    new.signature_kind := null;
    new.signature_story := null;
    new.signature_founder := null;
    new.signature_founded_year := null;
    new.signature_audience := null;
    new.signature_proof_url := null;
    new.made_in_cameroon := false;
    new.signature_applied_at := null;
    new.signature_reviewed_at := null;
    new.signature_note := null;
  else
    new.owner_id := old.owner_id;
    new.is_verified := old.is_verified;
    new.identity_verification_status := old.identity_verification_status;
    new.identity_verification_session_id := old.identity_verification_session_id;
    new.identity_verified_at := old.identity_verified_at;
    new.verification_rejected_reason := old.verification_rejected_reason;
    new.view_count := old.view_count;
    new.last_drop_email_at := old.last_drop_email_at;
    new.signature_status := old.signature_status;
    new.signature_kind := old.signature_kind;
    new.signature_story := old.signature_story;
    new.signature_founder := old.signature_founder;
    new.signature_founded_year := old.signature_founded_year;
    new.signature_audience := old.signature_audience;
    new.signature_proof_url := old.signature_proof_url;
    new.made_in_cameroon := old.made_in_cameroon;
    new.signature_applied_at := old.signature_applied_at;
    new.signature_reviewed_at := old.signature_reviewed_at;
    new.signature_note := old.signature_note;
  end if;
  return new;
end $$;
drop trigger if exists protect_shop_columns on shops;
create trigger protect_shop_columns before insert or update on shops
  for each row execute function public.protect_shop_columns();

-- ---------------------------------------------------------------
-- 2. Condition grades
-- ---------------------------------------------------------------
alter table products drop constraint if exists products_condition_check;
-- 'used' stays accepted only so a page open from before this change still saves; it is shown as "Good".
update products set condition = 'good' where condition = 'used';
alter table products add constraint products_condition_check
  check (condition in ('new', 'new_with_tags', 'like_new', 'very_good', 'good', 'fair', 'well_used', 'used'));
alter table products add column if not exists owned_for text
  check (owned_for in ('lt_1m', '1_6m', '6_12m', '1_2y', 'gt_2y'));

-- ---------------------------------------------------------------
-- 3. Offers
-- ---------------------------------------------------------------
alter table products add column if not exists accepts_offers boolean not null default false;

-- Private per-product negotiation settings: never readable by buyers
-- (products itself is public, so these can't live there).
create table if not exists product_offer_settings (
  product_id uuid primary key references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  autoaccept_fcfa integer check (autoaccept_fcfa > 0),
  floor_fcfa integer check (floor_fcfa > 0),
  updated_at timestamptz not null default now()
);
alter table product_offer_settings enable row level security;
drop policy if exists "Sellers manage their own offer settings" on product_offer_settings;
create policy "Sellers manage their own offer settings" on product_offer_settings for all
  using (shop_id in (select id from shops where owner_id = auth.uid()))
  with check (
    shop_id in (select id from shops where owner_id = auth.uid())
    and product_id in (select p.id from products p where p.shop_id = product_offer_settings.shop_id)
  );

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount_fcfa integer not null check (amount_fcfa > 0),
  counter_fcfa integer check (counter_fcfa > 0),
  agreed_fcfa integer check (agreed_fcfa > 0),
  message text check (char_length(message) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'countered', 'accepted', 'declined', 'withdrawn', 'expired', 'paid')),
  auto_decided boolean not null default false,
  expires_at timestamptz not null default now() + interval '48 hours',
  pay_by timestamptz,
  responded_at timestamptz,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_shop_status_idx on offers (shop_id, status, created_at desc);
create index if not exists offers_buyer_idx on offers (buyer_id, created_at desc);
create unique index if not exists offers_one_open_per_buyer
  on offers (product_id, buyer_id) where status in ('pending', 'countered');
alter table offers enable row level security;
drop policy if exists "Buyers see their own offers" on offers;
create policy "Buyers see their own offers" on offers for select using (buyer_id = auth.uid());
drop policy if exists "Sellers see offers on their shop" on offers;
create policy "Sellers see offers on their shop" on offers for select
  using (shop_id in (select id from shops where owner_id = auth.uid()));

-- ---------------------------------------------------------------
-- 4. Shared bags ("Ask someone to pay")
-- ---------------------------------------------------------------
create table if not exists shared_bags (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  shop_id uuid not null references shops(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  delivery jsonb not null,
  note text check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists shared_bags_creator_idx on shared_bags (creator_id, created_at desc);
alter table shared_bags enable row level security;
drop policy if exists "Creators see their own shared bags" on shared_bags;
create policy "Creators see their own shared bags" on shared_bags for select using (creator_id = auth.uid());

alter table orders add column if not exists offer_id uuid references offers(id) on delete set null;
alter table orders add column if not exists shared_bag_id uuid references shared_bags(id) on delete set null;
alter table orders add column if not exists payer_name text;

-- ---------------------------------------------------------------
-- 5. Views and popularity
-- ---------------------------------------------------------------
create table if not exists product_view_days (
  product_id uuid not null references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  primary key (product_id, day)
);
create index if not exists product_view_days_shop_idx on product_view_days (shop_id, day);
alter table product_view_days enable row level security;
drop policy if exists "Sellers see views on their shop" on product_view_days;
create policy "Sellers see views on their shop" on product_view_days for select
  using (shop_id in (select id from shops where owner_id = auth.uid()));

create or replace function public.bump_product_view(p_product uuid) returns void
language sql security definer set search_path = public as $$
  insert into product_view_days (product_id, shop_id, day, views)
  select id, shop_id, current_date, 1 from products where id = p_product and is_active
  on conflict (product_id, day) do update set views = product_view_days.views + 1;
$$;
revoke all on function public.bump_product_view(uuid) from public, anon, authenticated;

-- Score = paid units x10 + offers x3 + new favorites x4 + views, over
-- the last N days. Only ids and scores leave the function.
create or replace function public.product_popularity(p_days integer default 7, p_limit integer default 40)
returns table (product_id uuid, score numeric)
language sql stable security definer set search_path = public as $$
  with win as (
    select greatest(1, least(coalesce(p_days, 7), 90)) as d,
           greatest(1, least(coalesce(p_limit, 40), 100)) as l
  ),
  v as (select pv.product_id, sum(pv.views)::numeric s from product_view_days pv, win
        where pv.day > current_date - win.d group by 1),
  f as (select fa.product_id, count(*)::numeric * 4 s from favorites fa, win
        where fa.created_at > now() - make_interval(days => win.d) group by 1),
  o as (select oi.product_id, sum(oi.quantity)::numeric * 10 s from order_items oi join orders od on od.id = oi.order_id, win
        where od.paid_at > now() - make_interval(days => win.d) group by 1),
  x as (select ofr.product_id, count(*)::numeric * 3 s from offers ofr, win
        where ofr.created_at > now() - make_interval(days => win.d) group by 1)
  select p.id, coalesce(v.s, 0) + coalesce(f.s, 0) + coalesce(o.s, 0) + coalesce(x.s, 0) as score
  from products p
  left join v on v.product_id = p.id
  left join f on f.product_id = p.id
  left join o on o.product_id = p.id
  left join x on x.product_id = p.id
  where p.is_active and p.stock_quantity > 0
    and coalesce(v.s, 0) + coalesce(f.s, 0) + coalesce(o.s, 0) + coalesce(x.s, 0) > 0
  order by score desc, p.created_at desc
  limit (select l from win);
$$;
grant execute on function public.product_popularity(integer, integer) to anon, authenticated;

create or replace function public.shop_popularity(p_days integer default 30, p_limit integer default 12)
returns table (shop_id uuid, score numeric)
language sql stable security definer set search_path = public as $$
  with win as (
    select greatest(1, least(coalesce(p_days, 30), 180)) as d,
           greatest(1, least(coalesce(p_limit, 12), 50)) as l
  ),
  o as (select od.shop_id, count(*)::numeric * 10 s from orders od, win
        where od.paid_at > now() - make_interval(days => win.d) group by 1),
  fo as (select sf.shop_id, count(*)::numeric * 3 s from shop_follows sf, win
         where sf.created_at > now() - make_interval(days => win.d) group by 1),
  v as (select pv.shop_id, sum(pv.views)::numeric s from product_view_days pv, win
        where pv.day > current_date - win.d group by 1),
  r as (select rv.shop_id, sum(rv.rating - 3)::numeric * 2 s from reviews rv, win
        where rv.created_at > now() - make_interval(days => win.d) group by 1)
  select s.id, coalesce(o.s, 0) + coalesce(fo.s, 0) + coalesce(v.s, 0) + coalesce(r.s, 0) as score
  from shops s
  left join o on o.shop_id = s.id
  left join fo on fo.shop_id = s.id
  left join v on v.shop_id = s.id
  left join r on r.shop_id = s.id
  where s.is_active
    and coalesce(o.s, 0) + coalesce(fo.s, 0) + coalesce(v.s, 0) + coalesce(r.s, 0) > 0
  order by score desc
  limit (select l from win);
$$;
grant execute on function public.shop_popularity(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------
-- 6. Shop books
-- ---------------------------------------------------------------
create table if not exists product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  unit_cost_fcfa integer not null check (unit_cost_fcfa >= 0),
  updated_at timestamptz not null default now()
);
alter table product_costs enable row level security;
drop policy if exists "Sellers manage their own cost prices" on product_costs;
create policy "Sellers manage their own cost prices" on product_costs for all
  using (shop_id in (select id from shops where owner_id = auth.uid()))
  with check (
    shop_id in (select id from shops where owner_id = auth.uid())
    and product_id in (select p.id from products p where p.shop_id = product_costs.shop_id)
  );

create table if not exists shop_expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  spent_on date not null default current_date,
  category text not null check (category in ('stock', 'transport', 'rent', 'staff', 'marketing', 'phone_internet', 'packaging', 'fees', 'other')),
  amount_fcfa integer not null check (amount_fcfa > 0 and amount_fcfa <= 1000000000),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists shop_expenses_shop_idx on shop_expenses (shop_id, spent_on desc);
alter table shop_expenses enable row level security;
drop policy if exists "Sellers manage their own expenses" on shop_expenses;
create policy "Sellers manage their own expenses" on shop_expenses for all
  using (shop_id in (select id from shops where owner_id = auth.uid()))
  with check (shop_id in (select id from shops where owner_id = auth.uid()));

create table if not exists offline_sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price_fcfa integer not null check (unit_price_fcfa >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'momo', 'other')),
  sold_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists offline_sales_shop_idx on offline_sales (shop_id, sold_on desc);
alter table offline_sales enable row level security;
drop policy if exists "Sellers see their own shop sales" on offline_sales;
create policy "Sellers see their own shop sales" on offline_sales for select
  using (shop_id in (select id from shops where owner_id = auth.uid()));

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  change integer not null,
  reason text not null check (reason in ('restock', 'shop_sale', 'sale_undone', 'correction')),
  unit_cost_fcfa integer check (unit_cost_fcfa >= 0),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_shop_idx on stock_movements (shop_id, created_at desc);
alter table stock_movements enable row level security;
drop policy if exists "Sellers see their own stock movements" on stock_movements;
create policy "Sellers see their own stock movements" on stock_movements for select
  using (shop_id in (select id from shops where owner_id = auth.uid()));

-- A walk-in sale: records it and takes the units off the shelf in one step.
create or replace function public.books_record_sale(
  p_shop uuid, p_product uuid, p_title text, p_qty integer, p_unit_price integer,
  p_method text, p_sold_on date, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if not exists (select 1 from shops where id = p_shop and owner_id = auth.uid()) then
    raise exception 'not_owner';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000 then raise exception 'bad_quantity'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'bad_price'; end if;
  if p_product is not null then
    select title into v_title from products where id = p_product and shop_id = p_shop for update;
    if not found then raise exception 'bad_product'; end if;
    update products set stock_quantity = greatest(0, stock_quantity - p_qty) where id = p_product;
    insert into stock_movements (shop_id, product_id, change, reason, note)
    values (p_shop, p_product, -p_qty, 'shop_sale', left(p_note, 200));
  end if;
  if v_title is null then raise exception 'missing_title'; end if;
  insert into offline_sales (shop_id, product_id, title, quantity, unit_price_fcfa, payment_method, sold_on, note)
  values (p_shop, p_product, left(v_title, 120), p_qty, p_unit_price,
          case when p_method in ('cash', 'momo', 'other') then p_method else 'cash' end,
          coalesce(p_sold_on, current_date), left(p_note, 200))
  returning id into v_id;
  return v_id;
end $$;

-- Undo a walk-in sale entered by mistake: puts the units back.
create or replace function public.books_delete_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_sale offline_sales%rowtype;
begin
  select * into v_sale from offline_sales where id = p_sale;
  if not found or not exists (select 1 from shops where id = v_sale.shop_id and owner_id = auth.uid()) then
    raise exception 'not_owner';
  end if;
  if v_sale.product_id is not null then
    update products set stock_quantity = stock_quantity + v_sale.quantity where id = v_sale.product_id;
    insert into stock_movements (shop_id, product_id, change, reason)
    values (v_sale.shop_id, v_sale.product_id, v_sale.quantity, 'sale_undone');
  end if;
  delete from offline_sales where id = p_sale;
end $$;

-- New stock arrived: adds units, remembers the cost, optionally books
-- the purchase as a "stock" expense.
create or replace function public.books_restock(
  p_product uuid, p_qty integer, p_unit_cost integer, p_record_expense boolean, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_title text;
begin
  select p.shop_id, p.title into v_shop, v_title from products p
  join shops s on s.id = p.shop_id
  where p.id = p_product and s.owner_id = auth.uid()
  for update of p;
  if not found then raise exception 'not_owner'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then raise exception 'bad_quantity'; end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'bad_cost'; end if;
  update products set stock_quantity = stock_quantity + p_qty where id = p_product;
  insert into stock_movements (shop_id, product_id, change, reason, unit_cost_fcfa, note)
  values (v_shop, p_product, p_qty, 'restock', p_unit_cost, left(p_note, 200));
  if p_unit_cost is not null then
    insert into product_costs (product_id, shop_id, unit_cost_fcfa, updated_at)
    values (p_product, v_shop, p_unit_cost, now())
    on conflict (product_id) do update set unit_cost_fcfa = excluded.unit_cost_fcfa, updated_at = now();
    if coalesce(p_record_expense, false) and p_unit_cost * p_qty > 0 then
      insert into shop_expenses (shop_id, category, amount_fcfa, note)
      values (v_shop, 'stock', p_unit_cost * p_qty, left(p_qty || ' x ' || v_title, 200));
    end if;
  end if;
end $$;

revoke all on function public.books_record_sale(uuid, uuid, text, integer, integer, text, date, text) from public, anon;
revoke all on function public.books_delete_sale(uuid) from public, anon;
revoke all on function public.books_restock(uuid, integer, integer, boolean, text) from public, anon;
grant execute on function public.books_record_sale(uuid, uuid, text, integer, integer, text, date, text) to authenticated;
grant execute on function public.books_delete_sale(uuid) to authenticated;
grant execute on function public.books_restock(uuid, integer, integer, boolean, text) to authenticated;

-- ---------------------------------------------------------------
-- 8. Seller notifications for offers and Signature decisions
-- ---------------------------------------------------------------
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('new_order', 'dispute_filed', 'low_stock', 'payout_released', 'offer', 'signature'));
