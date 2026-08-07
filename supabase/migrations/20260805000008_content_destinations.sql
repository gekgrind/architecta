-- Blog & email content destinations — per-user connections to the user's OWN
-- WordPress site / Gmail mailbox / Brevo account, plus an audit trail of every
-- draft, publish and send Architecta performs on their behalf.
--
-- Idempotent. Secrets are app-encrypted ciphertext (AES-256-GCM, keyed on
-- PLATFORM_TOKEN_ENC_KEY) exactly like architecta_platform_connections; RLS
-- owner-scopes the rows, so the secret columns are useless without the app key.
-- Creates new tables only — no existing table is altered.

------------------------------------------------------------------------
-- Per-user destination connections (one row per user+destination)
--
-- Field mapping for the Google/Gmail connection:
--   provider                 -> destination            ('gmail')
--   google_user_id           -> external_account_id    (OIDC `sub`, stable)
--   email                    -> external_account_name  + config->>'email'
--   access_token_encrypted   -> secret_enc  + secret_iv  + secret_tag
--   refresh_token_encrypted  -> refresh_secret_enc + _iv + _tag
--   expires_at               -> expires_at
--   scopes                   -> scopes
-- Only the two token columns are secret; the rest are plaintext by design so
-- the settings UI can show which account is connected without decrypting.
------------------------------------------------------------------------
create table if not exists public.architecta_content_destinations (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  destination            text not null
    check (destination in ('wordpress','gmail','brevo')),
  external_account_id    text,
  external_account_name  text,
  -- AES-256-GCM ciphertext (base64) + iv + auth tag. Never plaintext.
  -- secret_*         : WordPress application password / Brevo API key / OAuth access token
  -- refresh_secret_* : OAuth refresh token, where the provider issues one
  secret_enc             text,
  secret_iv              text,
  secret_tag             text,
  refresh_secret_enc     text,
  refresh_secret_iv      text,
  refresh_secret_tag     text,
  -- Non-secret connection config ONLY (site URL, username, sender address).
  config                 jsonb not null default '{}'::jsonb,
  scopes                 text[] not null default '{}',
  expires_at             timestamptz,
  status                 text not null default 'connected'
    check (status in ('connected','expired','revoked','error')),
  meta                   jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, destination)
);
create index if not exists architecta_content_destinations_user_idx
  on public.architecta_content_destinations (user_id, destination);

------------------------------------------------------------------------
-- Publication history / audit (one row per destination attempt)
------------------------------------------------------------------------
create table if not exists public.architecta_publication_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  post_id       uuid references public.architecta_posts(id) on delete set null,
  campaign_id   uuid references public.architecta_campaigns(id) on delete set null,
  destination   text not null,
  action        text not null check (action in ('draft','publish','schedule')),
  status        text not null check (status in ('success','error')),
  external_id   text,
  external_url  text,
  error         text,
  trigger       text not null default 'manual'
    check (trigger in ('manual','campaign')),
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists architecta_publication_jobs_user_idx
  on public.architecta_publication_jobs (user_id, created_at desc);
create index if not exists architecta_publication_jobs_post_idx
  on public.architecta_publication_jobs (post_id);
create index if not exists architecta_publication_jobs_campaign_idx
  on public.architecta_publication_jobs (campaign_id);

------------------------------------------------------------------------
-- updated_at trigger (reuse the shared function)
------------------------------------------------------------------------
drop trigger if exists architecta_content_destinations_set_updated_at
  on public.architecta_content_destinations;
create trigger architecta_content_destinations_set_updated_at
  before update on public.architecta_content_destinations
  for each row execute function public.architecta_set_updated_at();

------------------------------------------------------------------------
-- Row Level Security (owner-scoped, same template as the rest of the app)
------------------------------------------------------------------------
do $$
declare
  t text;
  rls_tables text[] := array[
    'architecta_content_destinations',
    'architecta_publication_jobs'
  ];
begin
  foreach t in array rls_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_owner_select" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_select" on public.%I
         for select using (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_owner_insert" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_insert" on public.%I
         for insert with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_owner_update" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_update" on public.%I
         for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_owner_delete" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_delete" on public.%I
         for delete using (auth.uid() = user_id)', t, t);
  end loop;
end;
$$;
