-- Background website analysis: one durable job per Architecta onboarding session.
-- Idempotent. Not applied automatically — run during the production-configuration step.
--
-- The onboarding request fetches/extracts the website (SSRF-checked) and queues a
-- job here; the model call runs afterwards (Next.js after() fast path, then the
-- authenticated /api/cron/website-analysis backstop). Results live ONLY in this
-- table — they are composed into onboarding answers at read time and never written
-- into onboarding_sessions.answers, so a late result cannot overwrite user answers.
--
-- All writes go through the service role (server-side only). Signed-in users may
-- read their own status/result, but never the stored evidence, error codes or the
-- worker's claim/lease columns (column-level grants below).

create table if not exists public.architecta_website_analyses (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null unique references public.onboarding_sessions(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  url              text not null,
  -- sha256 of the normalized URL: re-submitting the same site is a no-op.
  input_hash       text not null,
  -- Extracted, SSRF-checked page evidence (JSON). Cleared once the job is terminal.
  evidence         text,
  status           text not null default 'queued'
                   check (status in ('queued','processing','completed','failed')),
  attempts         integer not null default 0 check (attempts >= 0),
  next_attempt_at  timestamptz not null default now(),
  -- Lease + write fence: final writes must match the claim that started them.
  claimed_at       timestamptz,
  claim_token      uuid,
  completed_at     timestamptz,
  -- Machine-readable failure category (never provider text or secrets).
  error_code       text,
  result           jsonb,
  model            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint architecta_website_analyses_processing_claimed
    check (status <> 'processing' or (claimed_at is not null and claim_token is not null)),
  constraint architecta_website_analyses_completed_result
    check (status <> 'completed' or result is not null)
);

-- Cron: due queued jobs, oldest first.
create index if not exists architecta_website_analyses_due_idx
  on public.architecta_website_analyses (next_attempt_at)
  where status = 'queued';

-- Cron: stale processing claims.
create index if not exists architecta_website_analyses_claimed_idx
  on public.architecta_website_analyses (claimed_at)
  where status = 'processing';

create index if not exists architecta_website_analyses_user_idx
  on public.architecta_website_analyses (user_id);

drop trigger if exists architecta_website_analyses_set_updated_at on public.architecta_website_analyses;
create trigger architecta_website_analyses_set_updated_at
  before update on public.architecta_website_analyses
  for each row execute function public.architecta_set_updated_at();

------------------------------------------------------------------------
-- Row Level Security: owner-only SELECT, no client writes.
------------------------------------------------------------------------

alter table public.architecta_website_analyses enable row level security;

drop policy if exists "architecta_website_analyses_owner_select" on public.architecta_website_analyses;
create policy "architecta_website_analyses_owner_select" on public.architecta_website_analyses
  for select using (auth.uid() = user_id);

-- RLS limits rows, not columns: restrict what a signed-in user can read to
-- status/result. evidence, error_code, input_hash and the claim/lease columns
-- stay server-only. anon gets nothing; the service role is unaffected.
revoke all on table public.architecta_website_analyses from anon, authenticated;
grant select (id, session_id, user_id, url, status, attempts, completed_at, result, model, created_at, updated_at)
  on table public.architecta_website_analyses to authenticated;
