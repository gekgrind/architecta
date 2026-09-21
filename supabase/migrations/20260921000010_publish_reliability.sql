-- Publishing reliability: claim/attempt tracking + explicit publishing/failed states.
-- Idempotent. Not applied automatically — run during the production-configuration step.

alter table public.architecta_posts
  drop constraint if exists architecta_posts_status_check;
alter table public.architecta_posts
  add constraint architecta_posts_status_check
  check (status in ('idea','draft','approved','scheduled','publishing','published','failed','archived'));

alter table public.architecta_posts
  add column if not exists publish_attempts   integer not null default 0,
  add column if not exists publish_claimed_at timestamptz,
  -- User-safe failure copy + machine-readable code (raw errors live in architecta_publish_log).
  add column if not exists publish_error      text,
  add column if not exists publish_error_code text;
