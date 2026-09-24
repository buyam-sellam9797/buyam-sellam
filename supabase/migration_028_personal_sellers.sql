-- "Sell one item": people who only want to sell something they own get
-- a simple personal shop, marked so the storefront can say "private seller".
alter table public.shops add column if not exists is_personal boolean not null default false;
