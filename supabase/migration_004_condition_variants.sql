-- Buyam Sellam — migration 004
-- Run this AFTER migration_003 has already been run once.
-- Adds product condition (important for Cameroon's thrifted-fashion
-- market) and simple size/color options, so buyers stop having to
-- guess and messaging sellers just to ask "do you have this in blue?".

alter table products add column if not exists condition text not null default 'new'
  check (condition in ('new', 'like_new', 'used'));
alter table products add column if not exists sizes jsonb not null default '[]'::jsonb;
alter table products add column if not exists colors jsonb not null default '[]'::jsonb;
