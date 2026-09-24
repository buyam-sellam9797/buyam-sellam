-- Delivery code at handover. Each order gets a 4-digit code the buyer
-- gives the seller only once they have the item; the seller enters it
-- to confirm delivery. Also a random view key so a guest buyer's order
-- page (and only theirs) can show the code.
-- Kept in its own table with RLS on and NO policies: only the server
-- (service role) can read it — a seller can't read their buyers' codes.
create table if not exists public.order_secrets (
  order_id uuid primary key references public.orders(id) on delete cascade,
  delivery_code text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  view_key text not null default replace(gen_random_uuid()::text, '-', ''),
  handover_attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.order_secrets enable row level security;

create or replace function public.create_order_secrets() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_secrets (order_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists orders_create_secrets on public.orders;
create trigger orders_create_secrets after insert on public.orders
  for each row execute function public.create_order_secrets();

insert into public.order_secrets (order_id) select id from public.orders on conflict do nothing;

revoke all on public.order_secrets from anon, authenticated;
revoke execute on function public.create_order_secrets() from anon, authenticated, public;
