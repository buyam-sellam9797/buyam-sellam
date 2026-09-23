-- Seller-configurable layaway ("pay in installments").
-- Shop-wide defaults the seller sets in their dashboard, plus an
-- optional per-product override of the number of payments
-- (null = follow the shop, 0 = no installments for this product).
alter table public.shops
  add column if not exists layaway_enabled boolean not null default true,
  add column if not exists layaway_installments smallint not null default 2,
  add column if not exists layaway_deposit_percent smallint not null default 50,
  add column if not exists layaway_interval_days smallint not null default 14;

alter table public.shops
  drop constraint if exists shops_layaway_installments_range,
  add constraint shops_layaway_installments_range check (layaway_installments between 2 and 6),
  drop constraint if exists shops_layaway_deposit_percent_range,
  add constraint shops_layaway_deposit_percent_range check (layaway_deposit_percent between 10 and 90),
  drop constraint if exists shops_layaway_interval_days_range,
  add constraint shops_layaway_interval_days_range check (layaway_interval_days between 3 and 60);

alter table public.products
  add column if not exists layaway_installments smallint;

alter table public.products
  drop constraint if exists products_layaway_installments_range,
  add constraint products_layaway_installments_range
    check (layaway_installments is null or layaway_installments = 0 or layaway_installments between 2 and 6);
