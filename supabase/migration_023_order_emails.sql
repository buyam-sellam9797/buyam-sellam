-- Order emails: where to send buyer updates for guest checkouts (signed-in
-- buyers use their account email), and in which language.
alter table public.orders
  add column if not exists buyer_email text,
  add column if not exists buyer_locale text;

alter table public.orders
  drop constraint if exists orders_buyer_locale_check,
  add constraint orders_buyer_locale_check check (buyer_locale is null or buyer_locale in ('en', 'fr'));
