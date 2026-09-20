-- migration_017_notifications.sql never actually got applied against
-- the live database (discovered while building this batch — the
-- notification bell was silently querying a table that didn't exist).
-- This re-creates it (create table if not exists is safe either way)
-- with the type check widened up front for the two new notification
-- types added in this batch.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  type text not null check (type in ('new_order', 'dispute_filed', 'low_stock', 'payout_released')),
  title text not null,
  body text,
  order_id uuid references orders(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_shop_id_created_at_idx
  on notifications (shop_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "Sellers view notifications on their shop" on notifications;
create policy "Sellers view notifications on their shop" on notifications
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

drop policy if exists "Sellers mark their own notifications read" on notifications;
create policy "Sellers mark their own notifications read" on notifications
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Ma boutique: social links + return policy.
alter table shops
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists return_policy text;

-- Delivery zones: optional, additive. A shop with none configured
-- keeps behaving exactly as before (flat/distance pricing at
-- checkout); this only changes anything for a shop that sets one up.
create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  fee_fcfa integer not null,
  eta_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists delivery_zones_shop_id_idx on delivery_zones (shop_id);
alter table delivery_zones enable row level security;

drop policy if exists "Anyone can view delivery zones" on delivery_zones;
create policy "Anyone can view delivery zones" on delivery_zones
  for select using (true);

drop policy if exists "Sellers manage their own delivery zones" on delivery_zones;
create policy "Sellers manage their own delivery zones" on delivery_zones
  for all using (
    shop_id in (select id from shops where owner_id = auth.uid())
  ) with check (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

alter table orders add column if not exists delivery_zone_name text;

-- Promotions: null = no promotion, no behavior change.
alter table products add column if not exists sale_price_fcfa integer;

-- Boosting: no-payment "pin to top of my own shop" toggle.
alter table products add column if not exists is_featured boolean not null default false;
