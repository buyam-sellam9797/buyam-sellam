-- Platform-wide settings an admin can change from the admin dashboard
-- without a code change or redeploy. First use: how many minutes of
-- inactivity before a signed-in account is automatically signed out.
--
-- Anyone may READ these (the inactivity timer runs in every visitor's
-- browser and needs the value; nothing stored here is secret). Nobody
-- can write through the public API — changes go through the
-- /api/admin/settings route, which checks the caller is an admin and
-- writes with the service role.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

insert into public.site_settings (key, value)
values ('idle_timeout_minutes', '30'::jsonb)
on conflict (key) do nothing;
