-- Buyam Sellam — migration 005
-- Run this AFTER migration_004 has already been run once.
-- Reviews originally required a logged-in buyer_id, but checkout is
-- guest-only (no account needed) — so a buyer who checked out as a
-- guest could never leave a review. This makes buyer_id optional and
-- adds buyer_phone as the guest identifier, matching how orders
-- already handle guest checkout (see migration_002). Also stops the
-- same order being reviewed more than once.

alter table reviews alter column buyer_id drop not null;
alter table reviews add column if not exists buyer_phone text;
alter table reviews add constraint reviews_order_id_key unique (order_id);
