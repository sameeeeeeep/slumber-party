-- ============================================================================
--  WHEN WAS THIS COUNTED?
--
--  visit_stats() answers with a snapshot, and the dashboard now adds the
--  sessions realtime delivers on top of it rather than asking for the count
--  again — recounting distinct sessions means walking the whole visits table,
--  which is the cost the aggregate exists to remove.
--
--  For that addition to be correct the browser has to know which rows the
--  snapshot already includes, and the only honest answer is the database's own
--  clock: a row is "after the snapshot" when its created_at is later than the
--  moment the aggregate ran. Comparing DB timestamps against the browser's
--  clock instead would be wrong by whatever the two disagree by, and every
--  second of disagreement is a session counted twice or not at all.
--
--  So: return that moment. Nothing else changes — same query, same shape, one
--  extra key. The dashboard falls back to its own clock when as_of is absent,
--  so this and the client can be deployed in either order.
--
--  Safe to apply while the site is live: create or replace on a stable,
--  read-only function. No table, policy or grant is touched.
-- ============================================================================

create or replace function public.visit_stats()
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with
  -- distinct sessions per funnel step. Covers 'landed'…'submitted' and the
  -- per-question 'q1'…'q8' steps in one pass; the dashboard picks out the ones
  -- it wants, so adding a step to the site needs no change here.
  step_counts as (
    select reached, count(distinct session_id)::int as sessions
      from public.visits
     group by reached
  ),

  -- One source per session: whatever it said on the first ping we have for it.
  -- id breaks the tie so two pings on the same timestamp resolve the same way
  -- every time rather than flapping between runs.
  first_source as (
    select distinct on (session_id)
           session_id,
           coalesce(source, 'unknown') as source
      from public.visits
     order by session_id, created_at, id
  ),
  source_counts as (
    select source, count(*)::int as sessions
      from first_source
     group by source
  ),

  -- Counted by row, NOT by distinct session. This is deliberate: it is what the
  -- panel has always shown, and quietly making it a session count here would
  -- move a number on a live dashboard for no reason anyone asked for.
  zone_counts as (
    select tz, count(*)::int as cnt
      from public.visits
     where tz is not null
     group by tz
  ),

  -- "Active now" is measured against the moving clock, so it can't come from a
  -- snapshot. These rows seed it at page load and realtime keeps it current
  -- from there. Five minutes of traffic is small, which is the point.
  recent_rows as (
    select v.id, v.session_id, v.created_at, f.source
      from public.visits v
      join first_source f using (session_id)
     where v.created_at > now() - interval '5 minutes'
  )

  -- Not an admin, no numbers. RLS protects the table itself, but this function
  -- is SECURITY DEFINER and so runs past it — this is the check that replaces
  -- the "admins read visits" policy for this path.
  select case when not public.is_admin() then null else json_build_object(
    'steps',
      coalesce((select json_object_agg(reached, sessions) from step_counts), '{}'::json),
    'sources',
      coalesce((select json_agg(json_build_object('source', source, 'sessions', sessions)
                                order by sessions desc) from source_counts), '[]'::json),
    'zones',
      coalesce((select json_agg(json_build_object('tz', tz, 'rows', cnt)
                                order by cnt desc) from zone_counts), '[]'::json),
    'sessions',
      (select count(distinct session_id)::int from public.visits),
    -- the cut-off this snapshot counts up to. `now()` is the start of the
    -- transaction, so it is never later than a row this statement could have
    -- seen: the dashboard may re-add a session at worst, never drop one.
    'as_of', now(),
    'recent',
      coalesce((select json_agg(json_build_object('id', id, 'session_id', session_id,
                                                  'created_at', created_at, 'source', source))
                  from recent_rows), '[]'::json)
  ) end;
$$;

revoke all on function public.visit_stats() from public;
revoke all on function public.visit_stats() from anon;
grant execute on function public.visit_stats() to authenticated;

-- ============================================================================
--  CHECKING IT
--
--    select public.visit_stats() -> 'as_of';
--
--  should come back as a timestamp a moment ago. If it is null you aren't in
--  public.admins — the whole function returns null in that case, which is the
--  same thing the dashboard reads as "fall back to counting client-side".
-- ============================================================================
