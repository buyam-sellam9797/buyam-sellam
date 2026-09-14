-- Adds an in-app notification center for sellers: a "you have a new
-- order" / "a buyer filed a dispute" alert they see right in the
-- dashboard, instead of only finding out by refreshing it themselves.
--
-- Inserts only ever happen from trusted server code (checkout
-- confirmation, the NotchPay webhook, dispute filing) using the
-- service-role key — same reasoning as the disputes/reviews tables:
-- most of those events are triggered by guest buyers with no
-- auth.uid() for a public insert policy to check against.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  type text not null check (type in ('new_order', 'dispute_filed')),
  title text not null,
  body text,
  order_id uuid references orders(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_shop_id_created_at_idx
  on notifications (shop_id, created_at desc);

alter table notifications enable row level security;

create policy "Sellers view notifications on their shop" on notifications
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Lets a seller mark their own notifications read (the only write the
-- dashboard's bell icon needs to make).
create policy "Sellers mark their own notifications read" on notifications
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );
