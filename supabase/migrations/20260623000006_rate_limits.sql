-- Phase 7: server-side rate limiting for AI routes (cost containment).
-- Fixed-window atomic counter, keyed on "<action>:<user_id>".
-- Called from the server via the service-role client only; the function is
-- SECURITY DEFINER so the (server-derived) key is authoritative and a user
-- cannot read or tamper with the counters directly.

create table if not exists public.architecta_rate_limits (
  bucket_key    text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- RLS on, with no policies: only the service role (which bypasses RLS) and the
-- SECURITY DEFINER function below can touch this table.
alter table public.architecta_rate_limits enable row level security;

create or replace function public.architecta_check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz;
  v_count        integer;
begin
  insert into public.architecta_rate_limits as rl (bucket_key, window_start, count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
    set
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rl.window_start
      end,
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else rl.count + 1
      end,
      updated_at = v_now
  returning rl.window_start, rl.count
  into v_window_start, v_count;

  return query
    select
      v_count <= p_limit,
      greatest(p_limit - v_count, 0),
      v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- Lock the function down: only the service role may execute it.
revoke all on function public.architecta_check_rate_limit(text, integer, integer) from public;
revoke all on function public.architecta_check_rate_limit(text, integer, integer) from anon;
revoke all on function public.architecta_check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.architecta_check_rate_limit(text, integer, integer) to service_role;
