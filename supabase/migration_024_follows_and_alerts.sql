-- Follow a shop + automatic back-in-stock / new-stock emails.

-- Buyers (signed in) can follow shops; followers get one email when the
-- shop adds new products (at most one such email per shop every 12 hours).
create table if not exists public.shop_follows (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);
create index if not exists shop_follows_user_idx on public.shop_follows(user_id);
alter table public.shop_follows enable row level security;
drop policy if exists "Users manage their own follows" on public.shop_follows;
create policy "Users manage their own follows" on public.shop_follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- New-stock announcements: which products were already announced, and
-- when the shop last emailed its followers.
alter table public.products add column if not exists announced_at timestamptz;
update public.products set announced_at = coalesce(created_at, now()) where announced_at is null;
alter table public.shops add column if not exists last_drop_email_at timestamptz;

-- Back-in-stock waitlist: guests can now leave an email (sent
-- automatically) as well as, or instead of, a phone number (the seller
-- reaches those on WhatsApp).
alter table public.restock_requests
  add column if not exists contact_email text,
  add column if not exists locale text;
drop policy if exists "Anyone can join a restock waitlist" on public.restock_requests;
create policy "Anyone can join a restock waitlist" on public.restock_requests
  for insert with check (
    (buyer_id is null and (
      (contact_phone is not null and length(trim(contact_phone)) > 0)
      or (contact_email is not null and length(trim(contact_email)) > 3)
    ))
    or buyer_id = auth.uid()
  );
