-- Adds a wide banner/cover photo for a shop's public page, shown
-- behind the existing circular logo — matches how most storefront
-- templates sellers already recognize (e.g. Shopizi) present a shop:
-- cover photo + overlapping profile picture up top, products below.
-- Purely additive: nullable, defaults to nothing, so every existing
-- shop keeps working exactly as before until its owner uploads one.
alter table shops add column if not exists cover_url text;
