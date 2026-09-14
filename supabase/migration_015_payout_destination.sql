-- Migration 015: seller payout destination
--
-- Payouts today are still sent by hand (an admin reads this and sends
-- real mobile money outside the platform, then marks it paid) — there
-- is no merchant disbursement API integrated yet, so nothing here
-- moves money automatically. What this adds is a place for a seller
-- to record which MTN/Orange number they want paid to, so whoever is
-- sending the money doesn't have to track them down over WhatsApp
-- every time.
alter table shops add column if not exists payout_provider text
  check (payout_provider in ('mtn', 'orange'));
alter table shops add column if not exists payout_phone_number text;
