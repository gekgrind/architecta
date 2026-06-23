-- Phase 3: persist UI-specific shape variants without bloating typed columns.
-- - `meta` holds rich shape data (weekly themes, post ideas, growth priorities, etc.).
-- - `kind` identifies which UI variant produced the strategy so views can hydrate correctly.

alter table public.architecta_content_strategies
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.architecta_content_strategies
  add column if not exists kind text not null default 'content_strategy'
    check (kind in ('content_strategy','content_architect','strategy_engine','custom'));
