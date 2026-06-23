-- Phase 2: update the default Anthropic model to a currently-valid ID.
-- claude-sonnet-4-5 was never released; the current Sonnet is 4.6.

alter table public.architecta_user_settings
  alter column anthropic_model set default 'claude-sonnet-4-6';

update public.architecta_user_settings
  set anthropic_model = 'claude-sonnet-4-6'
  where anthropic_model = 'claude-sonnet-4-5';
