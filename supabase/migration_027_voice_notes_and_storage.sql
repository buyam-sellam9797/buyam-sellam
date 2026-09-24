-- Voice notes on listings: a short audio clip recorded by the seller.
alter table public.products add column if not exists voice_note_url text;

-- Tighten product-images storage: uploads, replacements and deletions
-- are only allowed inside the folder of a shop the user owns
-- (every path is "<shop id>/..."). Before, any signed-in account could
-- overwrite or delete any shop's photos.
drop policy if exists "Authenticated sellers can upload product images" on storage.objects;
drop policy if exists "Authenticated sellers can update their product images" on storage.objects;
drop policy if exists "Authenticated sellers can delete their product images" on storage.objects;

create policy "Shop owners upload to their shop folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.shops where shops.id::text = (storage.foldername(objects.name))[1] and shops.owner_id = auth.uid())
  );
create policy "Shop owners update files in their shop folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.shops where shops.id::text = (storage.foldername(objects.name))[1] and shops.owner_id = auth.uid())
  );
create policy "Shop owners delete files in their shop folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.shops where shops.id::text = (storage.foldername(objects.name))[1] and shops.owner_id = auth.uid())
  );
