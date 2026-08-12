-- ============================================================================
--  TRAFFIC NUMBERS, COUNTED IN THE DATABASE
--
--  `visits` holds one row per session per funnel step, so it grows with every
--  visitor the site has ever had. The dashboard's five traffic panels only ever
--  wanted counts out of it — but the only way to count was to download all of
--  it, a thousand rows per round trip, on every page load. That was the one
--  cost in the admin that could never stop getting worse: every visitor made
--  the dashboard slower to open, permanently.
--
--  This does the counting where the rows already are. The answer is a few
--  hundred bytes instead of a few megabytes, and it costs the same on the day
--  of the party as it does today.
--
--  NOTHING HERE CHANGES WHAT THE DASHBOARD SAYS. Each block below reproduces
--  exactly what admin/index.html was computing in the browser, including the
--  two choices that look like mistakes and aren't:
--    · a session's source is its FIRST-seen source, not its latest
--    · timezones are counted by ROW, not by distinct session
--
--  It also fixes a failure the client could only paper over. The dashboard read
--  `visits` directly, under RLS — and RLS refuses by returning ZERO ROWS, not an
--  error. An admin whose visits policy isn't matching therefore sees a silent,
--  successful-looking empty table. That is what produced a completion rate of
--  125340%: six thousand applications divided by the five sessions realtime had
--  delivered since the page opened. SECURITY DEFINER plus an explicit is_admin()
--  check turns that failure mode into either the right numbers or nothing.
--
--  Safe to apply while the site is live: it only adds. No table is altered
--  beyond an `if not exists` column guard, no policy is changed, and the
--  existing read paths still work. Until this is applied the dashboard falls
--  back to counting client-side, so the two can be deployed in either order.
--
--  NO INDEXES ARE ADDED. An earlier draft created two. They were dropped on
--  purpose: every query below is a full aggregate over the table, which a
--  sequential scan serves better than an index, and `visits` takes a write on
--  every page view — so an unused index is pure write amplification on the
--  hottest table in the database. If first_source ever becomes the bottleneck,
--  (session_id, created_at) is the one to add, CONCURRENTLY, on its own.
-- ============================================================================

-- The dashboard selects visits.source, so it exists on the live database, but
-- it was added there directly and never landed in this repo. Guarded so this
-- file is correct against both.
alter table public.visits add column if not exists source text;

-- ------------------------------------------------------------ visit_stats()
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
    'recent',
      coalesce((select json_agg(json_build_object('id', id, 'session_id', session_id,
                                                  'created_at', created_at, 'source', source))
                  from recent_rows), '[]'::json)
  ) end;
$$;

-- Same audience as the dashboard itself: signed-in users, filtered to admins by
-- the is_admin() check inside. anon gets nothing, consistent with every other
-- policy in schema.sql.
revoke all on function public.visit_stats() from public;
revoke all on function public.visit_stats() from anon;
grant execute on function public.visit_stats() to authenticated;

-- ============================================================================
--  CHECKING IT
--  Run this as yourself in the SQL editor:
--
--    select public.visit_stats();
--
--  'sessions' is the number the overview's "sessions" tile should show, and it
--  must be GREATER than the applications count — everyone who applied landed
--  first. If it comes back null you aren't in public.admins; if 'sessions' is
--  still absurdly small, the visits table itself is short and the problem is
--  upstream in the /visit pings rather than in the dashboard.
-- ============================================================================
