-- Buyam Sellam — Douala fashion & beauty marketplace
-- Core database schema for Supabase (Postgres)
-- Run this in the Supabase SQL editor once the project exists.

-- ============================================================
-- PROFILES
-- One row per person (buyer, seller, or admin), linked to
-- Supabase's built-in auth.users table.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer', 'seller', 'admin')) default 'buyer',
  full_name text,
  phone_number text,           -- mobile money phone number, e.g. +2376XXXXXXXX
  city text default 'Douala',
  created_at timestamptz not null default now()
);

-- ============================================================
-- SHOPS
-- Each seller has one shop (their storefront on the platform).
-- ============================================================
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  shop_name text not null,
  slug text not null unique,          -- used in the shop's URL, e.g. /shop/mama-clara-fashion
  description text,
  whatsapp_number text,               -- for buyer/seller contact fallback
  city text default 'Douala',
  logo_url text,
  delivery_info text,                 -- free text set by the seller: areas covered, fees, timing
  is_verified boolean not null default false,   -- flips true once ID/business check is done
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- Kept intentionally small for the MVP: fashion & beauty only.
-- ============================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

insert into categories (name, slug) values
  ('Women''s Fashion', 'womens-fashion'),
  ('Men''s Fashion', 'mens-fashion'),
  ('Shoes & Accessories', 'shoes-accessories'),
  ('Beauty & Cosmetics', 'beauty-cosmetics'),
  ('Hair & Wigs', 'hair-wigs')
on conflict (slug) do nothing;

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  category_id uuid references categories(id),
  title text not null,
  description text,
  brand text,
  price_fcfa integer not null check (price_fcfa > 0),   -- price in CFA francs, whole numbers
  stock_quantity integer not null default 1,
  image_urls jsonb not null default '[]'::jsonb,        -- array of image URLs in Supabase storage
  condition text not null default 'new' check (condition in ('new', 'like_new', 'used')),
  sizes jsonb not null default '[]'::jsonb,             -- array of size strings, e.g. ["38","39","40"]
  colors jsonb not null default '[]'::jsonb,            -- array of color strings
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORDERS
-- One order = one buyer buying from one shop in one checkout.
-- Money sits in "paid_held" until the buyer confirms receipt —
-- this is the trust mechanic that classifieds sites don't have.
-- ============================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id),   -- null for guest checkout (buyer_phone identifies them instead)
  buyer_phone text,
  shop_id uuid not null references shops(id),
  status text not null default 'pending_payment' check (
    status in (
      'pending_payment',   -- checkout started, waiting on mobile money confirmation
      'paid_held',         -- payment received by platform, held for seller
      'shipped',           -- seller marked it as sent / ready for pickup
      'completed',         -- buyer confirmed receipt -> funds released to seller
      'disputed',          -- buyer or seller flagged a problem
      'refunded',
      'cancelled'
    )
  ),
  total_amount_fcfa integer not null,
  payment_provider text,           -- 'campay' | 'notchpay'
  payment_reference text,          -- ID returned by the payment provider
  delivery_method text,            -- 'seller_delivery' | 'pickup' | 'moto_partner'
  delivery_name text,              -- recipient name, collected at checkout
  delivery_city text,
  delivery_neighborhood text,
  delivery_address text,           -- street/landmark detail
  delivery_notes text,             -- free-text delivery instructions from the buyer
  payout_sent boolean not null default false,   -- has Lio actually sent the seller their money?
  payout_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price_fcfa integer not null
);

-- ============================================================
-- PAYMENT EVENTS
-- Audit trail of every webhook received from Campay/NotchPay,
-- so a payment dispute can always be traced back to raw data.
-- ============================================================
create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  provider text not null,
  event_type text not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- Buyer reviews a shop after an order is completed — this is
-- the reputation layer that builds trust over time.
-- ============================================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) unique,   -- one review per order
  shop_id uuid not null references shops(id),
  buyer_id uuid references profiles(id),   -- null for guest checkout (buyer_phone identifies them instead)
  buyer_phone text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (basic starting policies)
-- ============================================================
alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;

-- Anyone can read active shops and products (public storefront browsing)
create policy "Public can view active shops" on shops
  for select using (is_active = true);

create policy "Public can view active products" on products
  for select using (is_active = true);

-- A person can see and edit their own profile
create policy "Users manage their own profile" on profiles
  for all using (auth.uid() = id);

-- A seller can manage their own shop and products
create policy "Sellers manage their own shop" on shops
  for all using (auth.uid() = owner_id);

create policy "Sellers manage their own products" on products
  for all using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- A buyer sees their own orders; a seller sees orders placed on their shop
create policy "Buyers view their own orders" on orders
  for select using (auth.uid() = buyer_id);

create policy "Sellers view orders on their shop" on orders
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

create policy "Buyers create their own orders" on orders
  for insert with check (auth.uid() = buyer_id);

create policy "Sellers update orders on their shop" on orders
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

create policy "Public can view reviews" on reviews
  for select using (true);

-- Writing a review itself is done through a trusted server route using
-- the service role key, not this policy — same reasoning as order
-- confirmation above: most buyers check out as guests with no
-- auth.uid() at all, so a public RLS insert policy can't be the only
-- path in. Kept here so a future logged-in-only write path still has
-- a sane default.
create policy "Buyers write reviews on their own completed orders" on reviews
  for insert with check (auth.uid() = buyer_id);

-- ============================================================
-- STORAGE — public bucket for product photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "Authenticated sellers can upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "Authenticated sellers can update their product images" on storage.objects
  for update using (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "Authenticated sellers can delete their product images" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');
