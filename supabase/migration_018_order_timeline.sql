-- Precise timestamps for each stage of an order's life, so the seller
-- dashboard can show a real order timeline (received / paid / accepted
-- / shipped / delivered / payout released) instead of guessing from
-- status + updated_at. accepted_at and payout_sent_at already existed;
-- this adds the three still missing.
alter table orders
  add column if not exists paid_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Best-effort backfill for orders that already existed before this
-- migration: created_at is a reasonable stand-in for paid_at (payment
-- normally follows checkout within seconds/minutes on this guest
-- checkout flow), but there's no real historical record of exactly
-- when an older order was shipped or completed, so those are left
-- null rather than fabricated — the dashboard timeline is built to
-- simply omit a step it has no timestamp for.
update orders
set paid_at = created_at
where paid_at is null
  and status in ('paid_held', 'shipped', 'completed', 'disputed', 'refunded');
