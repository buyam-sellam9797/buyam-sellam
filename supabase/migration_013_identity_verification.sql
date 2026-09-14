-- Adds an automatic "does the ID card photo actually match this
-- person's face" verification path, on top of the existing manual
-- document review. Uses Didit (https://didit.me) — a third-party
-- identity-verification service — to scan the ID card and a live
-- selfie and confirm they're the same real person. Buyam Sellam
-- itself never touches the ID photo or selfie; it only starts a
-- session and reads back the final result.
alter table shops add column if not exists identity_verification_status text
  check (identity_verification_status in ('none', 'pending', 'in_review', 'approved', 'declined'))
  default 'none';
alter table shops add column if not exists identity_verification_session_id text;
alter table shops add column if not exists identity_verified_at timestamptz;
