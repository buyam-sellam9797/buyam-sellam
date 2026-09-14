-- Buyam Sellam — migration 008
-- Run this AFTER migration_007 has already been run once.
-- Supports: the seller onboarding wizard's "request verification" step,
-- per-aspect (product/seller/delivery) review scoring, and the
-- dashboard's shop-views stat.

alter table shops add column if not exists verification_requested_at timestamptz;
alter table shops add column if not exists view_count integer not null default 0;

alter table reviews add column if not exists product_rating integer check (product_rating between 1 and 5);
alter table reviews add column if not exists seller_rating integer check (seller_rating between 1 and 5);
alter table reviews add column if not exists delivery_rating integer check (delivery_rating between 1 and 5);
