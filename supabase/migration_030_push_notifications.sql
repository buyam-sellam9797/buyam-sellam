-- Push notifications for the installed app (and desktop browsers).
--
-- push_subscriptions: one row per device a user turned notifications on
-- for. Only the server (service role) reads or writes it; browsers go
-- through /api/push/subscribe, which checks who they are.
--
-- app_secrets: small server-only key/value store. Holds the VAPID key
-- pair that signs our pushes. RLS on with no policies = invisible to
-- anon and authenticated users; only the service role can read it.
-- The keys are inserted separately (not in this file) so they never
-- land in the repository.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  locale text check (locale in ('en', 'fr')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
