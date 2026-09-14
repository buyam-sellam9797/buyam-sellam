-- Buyam Sellam — migration 007
-- Run this AFTER migration_006 has already been run once.
-- Backs three things from the "admin dashboard is now critical" round
-- of feedback:
-- 1. Sellers can mark a held order as "preparing" before shipping it
--    (accepted_at), so buyers see a real step between "payment
--    protected" and "shipped" instead of nothing happening for days.
-- 2. A structured dispute / "report a problem" system, so a buyer's
--    report is an actual record with a reason and optional photo that
--    admin can see and resolve — not just a WhatsApp message that can
--    get lost once there's real order volume.
-- 3. Shops can set a numeric delivery fee + estimated delivery time,
--    so checkout can show a real delivery line instead of just text.

alter table orders add column if not exists accepted_at timestamptz;

alter table shops add column if not exists delivery_fee_fcfa integer;
alter table shops add column if not exists delivery_eta_text text;

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  shop_id uuid not null references shops(id),
  buyer_phone text,
  reason text not null,
  description text,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text,
  resolved_action text check (resolved_action in ('refunded', 'released')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table disputes enable row level security;

-- Disputes are only ever read/written through trusted server routes
-- using the service-role key — most buyers are guests with no
-- auth.uid() to check a write policy against, same reasoning as the
-- reviews table. This select policy exists so a seller who IS logged
-- in can still see disputes on their own shop directly if needed.
create policy "Sellers view disputes on their shop" on disputes
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Evidence photos a buyer attaches to a dispute report.
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', true)
on conflict (id) do nothing;

create policy "Public can view dispute evidence" on storage.objects
  for select using (bucket_id = 'dispute-evidence');
