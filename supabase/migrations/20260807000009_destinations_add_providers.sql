-- Widen the content-destination allow-list to the full set Architecta supports.
--
-- The original constraint (20260805000008) covered only wordpress/gmail/brevo.
-- This adds the three destinations landed since: the user's Outlook mailbox via
-- Microsoft Graph, their Ghost blog via the Admin API, and a generic
-- webhook/API endpoint for sites that aren't WordPress or Ghost.
--
-- Idempotent and additive: only the CHECK constraint changes. No column is
-- added, dropped, or rewritten, and no existing row can violate the new list
-- because it is a strict superset of the old one.

alter table public.architecta_content_destinations
  drop constraint if exists architecta_content_destinations_destination_check;

alter table public.architecta_content_destinations
  add constraint architecta_content_destinations_destination_check
  check (destination in (
    'wordpress',
    'ghost',
    'custom',
    'gmail',
    'microsoft',
    'brevo'
  ));
