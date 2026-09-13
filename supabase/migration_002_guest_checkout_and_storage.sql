-- Buyam Sellam — migration 002
-- Run this AFTER schema.sql has already been run once.
-- Adds: guest checkout (buyers don't need an account), sellers can
-- mark their own orders as shipped, and a public storage bucket for
-- product photos.

-- Buyers check out with just a phone number — no account required.
alter table orders alter column buyer_id drop not null;
alter table orders add column if not exists buyer_phone text;

-- Sellers can update the status of orders placed on their own shop
-- (e.g. marking an order "shipped").
create policy "Sellers update orders on their shop" on orders
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- Public bucket for product photos: anyone can view, only logged-in
-- sellers can upload/change/remove.
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
