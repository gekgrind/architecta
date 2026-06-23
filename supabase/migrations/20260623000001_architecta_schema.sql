-- Architecta complete schema (Phase 1 of backend build).
-- Idempotent: safe to run on a fresh project or one that already has the legacy tables.
-- Assumes auth.users exists (Supabase default). Assumes a `profiles` table exists
-- (created by the shared ecosystem migration) -- only ALTER/REFERENCE it.

------------------------------------------------------------------------
-- Extensions
------------------------------------------------------------------------
create extension if not exists "pgcrypto";

------------------------------------------------------------------------
-- Legacy / already-referenced tables (idempotent)
-- These are referenced by existing code paths in lib/onboarding, lib/ai,
-- and app/api/studio/* but were not present on the active project.
------------------------------------------------------------------------

create table if not exists public.brand_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  brand_name    text,
  industry      text,
  website       text,
  description   text,
  audience      text,
  tone          text,
  tone_voice    text,
  voice_description text,
  topics        jsonb default '{}'::jsonb,
  offers        text,
  mission       text,
  vision        text,
  values        text,
  typical_customers text,
  banned_phrases text[],
  required_elements text[],
  example_posts jsonb default '[]'::jsonb,
  ai_preferences jsonb default '{}'::jsonb,
  source        jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.onboarding_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  app             text not null,
  current_step    text,
  completed_steps text[] default '{}',
  flags           jsonb default '{}'::jsonb,
  answers         jsonb default '{}'::jsonb,
  status          text default 'in_progress',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, app)
);

create table if not exists public.studio_graphs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid,
  graph         jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table if not exists public.founder_style_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid,
  profile_text    text not null,
  confidence_score numeric(4,3) default 0.500,
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists founder_style_profiles_user_workspace_version_idx
  on public.founder_style_profiles (user_id, workspace_id, version desc);

create table if not exists public.memory_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid,
  event_type    text not null,
  payload       jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists memory_events_user_workspace_idx
  on public.memory_events (user_id, workspace_id);

create table if not exists public.ai_edit_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid,
  source        text default 'architecta',
  signal_type   text not null,
  signal_value  text not null,
  confidence    numeric(4,3) not null default 0.100,
  created_at    timestamptz not null default now()
);
create index if not exists ai_edit_memory_user_idx
  on public.ai_edit_memory (user_id, created_at desc);

------------------------------------------------------------------------
-- Architecta-prefixed tables (the 7 new tables from the audit)
------------------------------------------------------------------------

create table if not exists public.architecta_user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  workspace_id         uuid,
  text_provider        text not null default 'anthropic'
    check (text_provider in ('anthropic','openai','auto')),
  anthropic_model      text not null default 'claude-sonnet-4-5',
  openai_text_model    text not null default 'gpt-4o',
  openai_image_model   text not null default 'gpt-image-1',
  openai_video_model   text,
  default_platforms    text[] not null default '{linkedin,instagram,x}',
  approval_required    boolean not null default false,
  image_style          jsonb not null default '{}'::jsonb,
  video_style          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.architecta_content_strategies (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  workspace_id         uuid,
  brand_profile_id     uuid references public.brand_profiles(id) on delete set null,
  title                text,
  summary              text,
  pillars              jsonb not null default '[]'::jsonb,
  platform_strategy    jsonb not null default '{}'::jsonb,
  audience_angles      jsonb not null default '[]'::jsonb,
  content_themes       jsonb not null default '[]'::jsonb,
  posting_cadence      jsonb not null default '[]'::jsonb,
  quick_wins           jsonb not null default '[]'::jsonb,
  next_actions         jsonb not null default '[]'::jsonb,
  campaigns_seed       jsonb not null default '[]'::jsonb,
  source_input         jsonb not null default '{}'::jsonb,
  status               text not null default 'draft'
    check (status in ('draft','active','archived')),
  ai_provider          text,
  ai_model             text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists architecta_content_strategies_user_idx
  on public.architecta_content_strategies (user_id, created_at desc);

create table if not exists public.architecta_campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid,
  strategy_id     uuid references public.architecta_content_strategies(id) on delete set null,
  name            text not null,
  theme           text,
  goal            text,
  launch_date     date,
  status          text not null default 'idea'
    check (status in ('idea','planning','active','complete','archived')),
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists architecta_campaigns_user_idx
  on public.architecta_campaigns (user_id, created_at desc);

create table if not exists public.architecta_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  workspace_id       uuid,
  campaign_id        uuid references public.architecta_campaigns(id) on delete set null,
  strategy_id        uuid references public.architecta_content_strategies(id) on delete set null,
  platform           text not null,
  title              text,
  hook               text,
  caption            text,
  body               text,
  hashtags           text[] not null default '{}',
  cta                text,
  image_prompt       text,
  video_prompt       text,
  image_asset_id     uuid,
  video_asset_id     uuid,
  status             text not null default 'draft'
    check (status in ('idea','draft','approved','scheduled','published','archived')),
  scheduled_for      timestamptz,
  published_at       timestamptz,
  ai_provider        text,
  ai_model           text,
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists architecta_posts_user_created_idx
  on public.architecta_posts (user_id, created_at desc);
create index if not exists architecta_posts_user_status_idx
  on public.architecta_posts (user_id, status);
create index if not exists architecta_posts_campaign_idx
  on public.architecta_posts (campaign_id);

create table if not exists public.architecta_content_calendar_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid,
  post_id         uuid references public.architecta_posts(id) on delete set null,
  campaign_id     uuid references public.architecta_campaigns(id) on delete set null,
  scheduled_for   timestamptz not null,
  platform        text not null,
  status          text not null default 'idea'
    check (status in ('idea','draft','approved','scheduled','published')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists architecta_calendar_user_when_idx
  on public.architecta_content_calendar_items (user_id, scheduled_for);

create table if not exists public.architecta_generated_assets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  workspace_id     uuid,
  post_id          uuid references public.architecta_posts(id) on delete cascade,
  asset_type       text not null check (asset_type in ('image','video')),
  provider         text not null,
  model            text not null,
  prompt           text not null,
  storage_bucket   text,
  storage_path     text,
  external_url     text,
  width            integer,
  height           integer,
  duration_seconds integer,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists architecta_assets_user_idx
  on public.architecta_generated_assets (user_id, created_at desc);
create index if not exists architecta_assets_post_idx
  on public.architecta_generated_assets (post_id);

create table if not exists public.architecta_llm_usage (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid,
  task            text not null,
  tier            text,
  provider        text not null,
  model           text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  total_tokens    integer not null default 0,
  cost_usd        numeric(10,5) not null default 0,
  used_fallback   boolean not null default false,
  latency_ms      integer,
  request_id      text,
  route_reason    text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists architecta_llm_usage_user_idx
  on public.architecta_llm_usage (user_id, created_at desc);

------------------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------------------

create or replace function public.architecta_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  triggered_tables text[] := array[
    'brand_profiles',
    'onboarding_sessions',
    'studio_graphs',
    'founder_style_profiles',
    'architecta_user_settings',
    'architecta_content_strategies',
    'architecta_campaigns',
    'architecta_posts',
    'architecta_content_calendar_items'
  ];
begin
  foreach t in array triggered_tables loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I',
      t, t
    );
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
       for each row execute function public.architecta_set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------

do $$
declare
  t text;
  rls_tables text[] := array[
    'brand_profiles',
    'onboarding_sessions',
    'studio_graphs',
    'founder_style_profiles',
    'memory_events',
    'ai_edit_memory',
    'architecta_user_settings',
    'architecta_content_strategies',
    'architecta_campaigns',
    'architecta_posts',
    'architecta_content_calendar_items',
    'architecta_generated_assets',
    'architecta_llm_usage'
  ];
begin
  foreach t in array rls_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_owner_select" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_select" on public.%I
         for select using (auth.uid() = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_owner_insert" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_insert" on public.%I
         for insert with check (auth.uid() = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_owner_update" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_update" on public.%I
         for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_owner_delete" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_delete" on public.%I
         for delete using (auth.uid() = user_id)',
      t, t
    );
  end loop;
end;
$$;
