-- Migration 014: seller-controlled shop status and opening hours
--
-- Lets a seller mark their shop temporarily closed (vacation, fully
-- out of stock, etc.) without deactivating it. This is deliberately a
-- separate flag from is_active: is_active is the admin-controlled
-- "allowed on the platform at all" switch, while is_open is the
-- seller's own day-to-day "open for business right now" toggle.
-- Checkout is blocked server-side while a shop is closed (see
-- src/app/api/checkout/route.ts), not just hidden in the UI.
alter table shops add column if not exists is_open boolean not null default true;
alter table shops add column if not exists closed_message text;

-- Structured weekly opening hours, e.g.
-- {"mon": {"closed": false, "open": "08:00", "close": "18:00"}, "sun": {"closed": true}}
-- Optional — a shop with no business_hours set is treated as always
-- open during is_open, exactly like before this migration.
alter table shops add column if not exists business_hours jsonb;
