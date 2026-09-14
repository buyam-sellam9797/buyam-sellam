-- Buyam Sellam — migration 009
-- Run this AFTER migration_008 has already been run once.
-- Supports: real document-based seller verification (still optional —
-- a shop can sell without it, verification just unlocks the badge and
-- a small ranking boost), and admin promotion via the admin UI instead
-- of hand-editing the profiles table.

alter table shops add column if not exists verification_id_photo_path text;
alter table shops add column if not exists verification_note text;
alter table shops add column if not exists verification_rejected_reason text;

-- Private bucket — unlike product-images/dispute-evidence, ID photos
-- must never be publicly readable. Only the service role (admin API
-- routes) can read from it; sellers can only upload to their own
-- shop's folder.
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
