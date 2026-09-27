-- Phase 2 (AI spend guardrails): a settings row created without an explicit
-- provider choice must not pin the user to a paid provider. "auto" lets
-- server-side task routing pick the provider/model.
--
-- Only the column default changes. Existing rows are NOT rewritten: a stored
-- 'anthropic' may be a deliberate user choice and cannot be told apart from
-- the old default.

alter table public.architecta_user_settings
  alter column text_provider set default 'auto';
