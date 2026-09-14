-- Buyam Sellam — migration 006
-- Run this AFTER migration_005 has already been run once.
-- Three additions from seller/buyer feedback:
-- 1. Orders capture actual delivery details at checkout (who to deliver
--    to, and where) instead of just a mobile money phone number —
--    sellers were having to ask buyers for this over WhatsApp every time.
-- 2. Shops can describe their own delivery areas/fees/timing as free
--    text, shown on every one of their product pages, so "delivery
--    available" actually means something.
-- 3. Products can carry a brand name, since fashion/beauty buyers
--    search and decide by brand as much as by category.

alter table orders add column if not exists delivery_name text;
alter table orders add column if not exists delivery_city text;
alter table orders add column if not exists delivery_neighborhood text;
alter table orders add column if not exists delivery_address text;

alter table shops add column if not exists delivery_info text;

alter table products add column if not exists brand text;
