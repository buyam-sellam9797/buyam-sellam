-- Buyam Sellam — migration 010
-- Run this AFTER migration_009 has already been run once.
-- Adds real buyer accounts: signup/login (reusing the same profiles
-- table and Supabase Auth already used for sellers), a saved-addresses
-- table, and order history tied to buyer_id. Guest checkout (no
-- account, identified by buyer_phone only) keeps working exactly as
-- before — this only adds a second, optional path.

create table if not exists buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  label text,                  -- e.g. "Home", "Work" — shown in the picker, not required
  full_name text not null,
  phone text not null,
  city text not null,
  neighborhood text,
  address text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table buyer_addresses enable row level security;

create policy "Buyers manage their own addresses" on buyer_addresses
  for all using (auth.uid() = buyer_id) with check (auth.uid() = buyer_id);

-- The "Buyers view their own orders" / "Buyers create their own orders"
-- policies on `orders` already exist from the original schema (they were
-- inert until now, since buyer_id was never set by any code path) —
-- nothing to change there. Same for the buyer_id column on `reviews`.
