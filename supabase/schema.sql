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
  delivery_fee_fcfa integer,          -- flat delivery fee shown at checkout, if the seller sets one
  delivery_eta_text text,             -- e.g. "24-48h in Douala"
  latitude double precision,          -- shop's pinned location, optional — enables distance-based delivery pricing and "near me" browse sorting
  longitude double precision,
  is_verified boolean not null default false,   -- flips true once ID/business check is done
  is_active boolean not null default true,
  verification_requested_at timestamptz,   -- seller asked for a verification review, from the onboarding wizard
  view_count integer not null default 0,   -- storefront page views, shown on the seller dashboard
  verification_id_photo_path text,      -- path (not a public URL) inside the private verification-documents bucket
  verification_note text,               -- seller's own note submitted with a verification request (e.g. ID/business reg number)
  verification_rejected_reason text,    -- set by admin when a request is turned down, shown back to the seller
  -- Automatic ID + live-selfie verification via Didit (see src/lib/didit.ts).
  -- A separate path from the manual review fields above — either one
  -- getting approved sets is_verified true. 'approved' here means Didit
  -- itself confirmed the selfie matches the ID card's photo.
  identity_verification_status text
    check (identity_verification_status in ('none', 'pending', 'in_review', 'approved', 'declined'))
    default 'none',
  identity_verification_session_id text,
  identity_verified_at timestamptz,
  -- Seller-controlled "open for business right now" toggle — separate
  -- from is_active, which is the admin-controlled "allowed on the
  -- platform at all" switch. Checkout is blocked while is_open is
  -- false (see src/app/api/checkout/route.ts).
  is_open boolean not null default true,
  closed_message text,
  business_hours jsonb,
  -- Where a seller wants their payout sent. Payouts are still sent by
  -- hand today (no disbursement API integrated) — this just gives the
  -- admin a fixed place to send money instead of asking each time.
  payout_provider text check (payout_provider in ('mtn', 'orange')),
  payout_phone_number text,
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
  delivery_fee_fcfa integer,       -- the delivery fee actually charged (flat, or distance-based — see src/lib/delivery.ts)
  delivery_latitude double precision,   -- buyer's shared location at checkout, if any (enables distance-based pricing)
  delivery_longitude double precision,
  delivery_distance_km numeric,    -- straight-line distance from shop to buyer, when both locations were known
  payout_sent boolean not null default false,   -- has Lio actually sent the seller their money?
  payout_sent_at timestamptz,
  accepted_at timestamptz,         -- seller marked "preparing" (before shipping)
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
-- BUYER ADDRESSES
-- Saved delivery addresses for logged-in buyers, so checkout can be a
-- one-tap pick instead of retyping everything each time. Guests never
-- touch this table — they just fill delivery fields directly at checkout.
-- ============================================================
create table if not exists buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  city text not null,
  neighborhood text,
  address text,
  notes text,
  latitude double precision,   -- optional pinned location, enables distance-based delivery pricing at checkout
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
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
  rating integer not null check (rating between 1 and 5),   -- overall rating (average of the three below, when given)
  product_rating integer check (product_rating between 1 and 5),
  seller_rating integer check (seller_rating between 1 and 5),
  delivery_rating integer check (delivery_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- A seller's public reply to this review (e.g. thanking a buyer or
  -- addressing a complaint). Null until the seller writes one.
  seller_reply text,
  seller_reply_at timestamptz
);

-- ============================================================
-- DISPUTES
-- A structured "report a problem" record — reason, description, and
-- an optional evidence photo — so a buyer's report is something admin
-- can actually review and resolve, not just a WhatsApp message.
-- ============================================================
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

-- ============================================================
-- NOTIFICATIONS (migration 017)
-- In-app alerts for sellers — a new paid order, a buyer's dispute — so
-- they find out from the dashboard's own bell icon instead of only by
-- refreshing it themselves.
-- ============================================================
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

-- ============================================================
-- ROW LEVEL SECURITY (basic starting policies)
-- ============================================================
alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table buyer_addresses enable row level security;
alter table notifications enable row level security;

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

-- A buyer sees their own orders; a seller sees orders placed on their shop.
-- Buyers can be logged in (buyer_id set, read directly through these
-- policies via the buyer's own session) or guests (buyer_id null,
-- identified only by buyer_phone — those reads/writes go through
-- trusted server routes using the service-role key instead, e.g.
-- /api/orders/[id] and /api/orders/lookup, since a guest has no
-- auth.uid() for RLS to check against).
create policy "Buyers view their own orders" on orders
  for select using (auth.uid() = buyer_id);

create policy "Buyers manage their own addresses" on buyer_addresses
  for all using (auth.uid() = buyer_id) with check (auth.uid() = buyer_id);

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

-- Lets the seller dashboard show what was actually ordered (product +
-- quantity), not just a total amount — without this, order_items has
-- RLS on but no read policy, so it would come back empty for sellers.
create policy "Sellers view order items for their own orders" on order_items
  for select using (
    order_id in (
      select id from orders where shop_id in (
        select id from shops where owner_id = auth.uid()
      )
    )
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

-- A seller can reply to reviews left on their own shop (see migration
-- 016). RLS is row-level only, so this technically also permits
-- updating other columns on the row via a direct API call — the same
-- accepted trade-off as "Sellers update orders on their shop" below;
-- the app's own UI only ever writes seller_reply/seller_reply_at.
create policy "Sellers reply to reviews on their shop" on reviews
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Disputes are only ever read/written through trusted server routes
-- using the service-role key — most buyers are guests with no
-- auth.uid() to check a write policy against, same reasoning as the
-- reviews table above.
create policy "Sellers view disputes on their shop" on disputes
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Inserts only ever happen from trusted server code (see migration 017's
-- own comment for why) — these two policies are just what the
-- dashboard's notification bell needs: read its shop's alerts, and mark
-- them read.
create policy "Sellers view notifications on their shop" on notifications
  for select using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

create policy "Sellers mark their own notifications read" on notifications
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- ============================================================
-- STORAGE — public buckets for product photos and dispute evidence
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

insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', true)
on conflict (id) do nothing;

create policy "Public can view dispute evidence" on storage.objects
  for select using (bucket_id = 'dispute-evidence');

-- Private — unlike the two buckets above, ID photos must never be
-- publicly readable. No select policy is added here on purpose: only
-- the service role (used by the admin API routes) can read from it,
-- which bypasses RLS entirely. Sellers can only upload into their own
-- shop's folder within the bucket.
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy "Sellers upload their own verification documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and exists (
      select 1 from shops
      where shops.id::text = (storage.foldername(name))[1]
        and shops.owner_id = auth.uid()
    )
  );
