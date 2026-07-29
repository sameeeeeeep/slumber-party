-- ============================================================================
--  Khushi's Secret Slumber Party — database
--  Paste this whole file into Supabase → SQL Editor → Run. It is idempotent,
--  so re-running it is safe.
--
--  SECURITY MODEL, in one line: the public anon key can neither read nor write
--  anything. Writes arrive through the Edge Functions (which hold the service
--  role key server-side); reads require a logged-in user who is in `admins`.
--  So the key sitting in the site's JavaScript is worthless on its own.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- applications
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  name        text not null,
  city        text,
  age         smallint,
  role        text,
  handle      text,
  phone       text,
  email       text,
  why         text,

  -- Context captured in the browser. `tz` is the IANA timezone (Asia/Kolkata,
  -- Europe/London …). We deliberately do NOT geolocate by IP: the timezone plus
  -- the city they typed is enough for the dashboard map, needs no third-party
  -- lookup, and means there is no tracking disclosure to make.
  tz          text,
  referrer    text,
  user_agent  text,

  -- There is no public API that returns a follower count for an arbitrary
  -- Instagram handle (Meta's Graph API only covers accounts that authorise you).
  -- This column exists so you can fill it in by hand, or from a paid data
  -- provider, without a schema change.
  followers   integer,

  notes       text,
  status      text not null default 'new'
              check (status in ('new','shortlisted','invited','declined'))
);

create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists applications_city_idx       on public.applications (lower(city));
-- one application per email; the Edge Function turns a clash into a friendly reply
create unique index if not exists applications_email_key
  on public.applications (lower(email)) where email is not null;

-- --------------------------------------------------------------------- visits
-- One row per session per funnel step, so the dashboard can show visits and
-- where people drop off. No IP, no cookie, no fingerprint — just a random id
-- kept in that browser's sessionStorage.
create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  text not null,
  tz          text,
  referrer    text,
  device      text,
  reached     text not null default 'landed'
              check (reached in ('landed','entered','opened_dm','started_form','submitted'))
);
create index if not exists visits_created_at_idx on public.visits (created_at desc);
create index if not exists visits_session_idx    on public.visits (session_id, reached);

-- ------------------------------------------------------------------ rate limit
-- Salted hash of the submitter's IP, kept only to throttle floods. Not joined
-- to applications, so it can't be used to re-identify anybody.
create table if not exists public.submit_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_hash    text not null,
  kind       text not null default 'application'
);
create index if not exists submit_log_idx on public.submit_log (ip_hash, kind, created_at desc);

-- ---------------------------------------------------------------- who may read
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.applications enable row level security;
alter table public.visits       enable row level security;
alter table public.submit_log   enable row level security;
alter table public.admins       enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins read applications"   on public.applications;
drop policy if exists "admins update applications" on public.applications;
drop policy if exists "admins read visits"         on public.visits;
drop policy if exists "admins read self"           on public.admins;

create policy "admins read applications" on public.applications
  for select to authenticated using (public.is_admin());

-- so you can shortlist / add notes straight from the dashboard
create policy "admins update applications" on public.applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins read visits" on public.visits
  for select to authenticated using (public.is_admin());

create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- No policy at all on submit_log, and none for `anon` anywhere: with RLS on and
-- no matching policy, every anon request returns empty. That is the point.

-- ============================================================================
--  Realtime — the dashboard subscribes to these, so rows appear as they land
-- ============================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.applications';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.visits';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================================
--  LAST STEP — run this once, after you've created your admin user under
--  Authentication → Users, with YOUR address in place of the placeholder:
--
--    insert into public.admins (user_id, email)
--    select id, email from auth.users where email = 'you@yourdomain.com'
--    on conflict (user_id) do nothing;
--
--  Then turn OFF public signups: Authentication → Providers → Email →
--  "Allow new users to sign up". Without that, anyone could register and,
--  although RLS would still refuse them every row, you'd have strangers in
--  your auth table.
-- ============================================================================
