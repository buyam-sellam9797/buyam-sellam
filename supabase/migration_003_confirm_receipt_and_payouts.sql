-- Buyam Sellam — migration 003
-- Run this AFTER migration_002 has already been run once.
-- Adds: a way to track that a completed order's money has actually
-- been paid out to the seller (separate from "buyer confirmed
-- receipt"), and an admin role so Lio can see/manage payouts across
-- every shop from one place.

alter table orders add column if not exists payout_sent boolean not null default false;
alter table orders add column if not exists payout_sent_at timestamptz;

-- Buyer confirmation itself (shipped -> completed) is done through a
-- trusted server route using the service role key, not a public RLS
-- policy — an order id is hard to guess, but a public write policy
-- would let anyone who has one also rewrite other columns on that
-- row (amount, phone, etc.), which the server route guards against.
