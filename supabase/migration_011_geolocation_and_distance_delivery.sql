-- Buyam Sellam — migration 011
-- Run this AFTER migration_010 has already been run once.
-- Adds real geolocation: sellers can optionally pin their shop's exact
-- location, buyers can optionally share theirs (or save it on an
-- address), and when both are known, delivery pricing is calculated
-- automatically from the distance between them instead of always
-- being the shop's flat fee. Everything here is additive and nullable
-- — a shop that never pins a location, or a buyer who never shares
-- theirs, keeps working exactly as before (flat fee, no distance sort).

alter table shops add column if not exists latitude double precision;
alter table shops add column if not exists longitude double precision;

alter table buyer_addresses add column if not exists latitude double precision;
alter table buyer_addresses add column if not exists longitude double precision;

alter table orders add column if not exists delivery_fee_fcfa integer;
alter table orders add column if not exists delivery_latitude double precision;
alter table orders add column if not exists delivery_longitude double precision;
alter table orders add column if not exists delivery_distance_km numeric;
