-- Phase 8: social publishing — per-user platform connections + publish history.
-- Idempotent. Tokens are stored as app-encrypted ciphertext (AES-256-GCM); RLS
-- owner-scopes the rows, and the token columns are useless without the app key.

------------------------------------------------------------------------
-- Per-user platform connections (one row per user+platform)
------------------------------------------------------------------------
create table if not exists public.architecta_platform_connections (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  platform               text not null,
  external_account_id    text,
  external_account_name  text,
  -- AES-256-GCM ciphertext (base64) + iv + auth tag. Never plaintext.
  access_token_enc       text,
  refresh_token_enc      text,
  token_iv               text,
  token_tag              text,
  refresh_token_iv       text,
  refresh_token_tag      text,
  scopes                 text[] not null default '{}',
  expires_at             timestamptz,
  status                 text not null default 'connected'
    check (status in ('connected','expired','revoked','error')),
  meta                   jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, platform)
);
create index if not exists architecta_platform_connections_user_idx
  on public.architecta_platform_connections (user_id, platform);

------------------------------------------------------------------------
-- Publish history / audit (one row per publish attempt)
------------------------------------------------------------------------
create table if not exists public.architecta_publish_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  post_id          uuid references public.architecta_posts(id) on delete set null,
  platform         text not null,
  status           text not null check (status in ('success','error')),
  external_post_id text,
  external_url     text,
  error            text,
  trigger          text not null default 'manual'
    check (trigger in ('manual','scheduled')),
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists architecta_publish_log_user_idx
  on public.architecta_publish_log (user_id, created_at desc);
create index if not exists architecta_publish_log_post_idx
  on public.architecta_publish_log (post_id);

------------------------------------------------------------------------
-- updated_at trigger (reuse the shared function)
------------------------------------------------------------------------
drop trigger if exists architecta_platform_connections_set_updated_at
  on public.architecta_platform_connections;
create trigger architecta_platform_connections_set_updated_at
  before update on public.architecta_platform_connections
  for each row execute function public.architecta_set_updated_at();

------------------------------------------------------------------------
-- Row Level Security (owner-scoped, same template as the rest of the app)
------------------------------------------------------------------------
do $$
declare
  t text;
  rls_tables text[] := array[
    'architecta_platform_connections',
    'architecta_publish_log'
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
