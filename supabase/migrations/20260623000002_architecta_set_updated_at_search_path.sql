-- Phase 1 follow-up: pin the search_path on the architecta_set_updated_at()
-- trigger function to satisfy the function_search_path_mutable advisor.

alter function public.architecta_set_updated_at()
  set search_path = public, pg_temp;
