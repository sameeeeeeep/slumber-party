-- ============================================================================
--  Khushi's Secret Slumber Party — guest check-in
--  Paste this whole file into Supabase → SQL Editor → Run. Idempotent, so
--  re-running is safe. Run schema.sql first (this reuses public.is_admin()).
--
--  SECURITY MODEL is the same as the rest of the project: the anon key can
--  neither read nor write any of this. Check-ins arrive through the `checkin`
--  Edge Function (service role, server-side); reads require a logged-in user
--  who is in `admins`.
--
--  THIS TABLE HOLDS GOVERNMENT ID DOCUMENTS. Two consequences worth stating
--  where the schema lives, because they are easy to undo by accident:
--    1. The storage bucket MUST stay private. A public bucket makes every
--       uploaded Aadhaar/licence readable by anyone who can guess a path.
--    2. Nothing here grants `anon` a single row. If you ever add a "just let
--       the dashboard read with the anon key" policy to save a login, you have
--       published the guest list and their ID documents. Don't.
-- ============================================================================

-- ------------------------------------------------------------------- guests
-- The roster: who is expected. Populated from the dashboard (paste a list) so
-- the check-in view can show who's done and who hasn't. `code` matches the
-- besties invite code where there is one, so the two lists can line up.
create table if not exists public.guests (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  code       text,                       -- besties invite code, when they have one
  -- postal address, for posting the physical invite. Home addresses, so they sit
  -- behind the same admin-only RLS as everything else in here and are in the CSV
  -- export rather than on screen by default.
  address    text,
  notes      text
);
-- for a table created before the column existed
alter table public.guests add column if not exists address text;
create unique index if not exists guests_name_key on public.guests (lower(name));
create index if not exists guests_created_idx on public.guests (created_at desc);

-- ----------------------------------------------------------------- checkins
create table if not exists public.checkins (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  name         text not null,
  -- stored in E.164-ish normalised form (digits only, country code included) so
  -- "+91 98765 43210" and "9876543210" can't both check in as different people
  phone        text not null,
  email        text not null,

  pyjama_size  text not null check (pyjama_size in ('XS','S','M','L','XL','XXL')),
  meal         text not null check (meal in ('veg','non-veg','vegan','allergic','jain')),
  meal_notes   text,                     -- what they're allergic to, in their words

  -- path inside the PRIVATE `checkin-ids` bucket. Never a public URL: the
  -- dashboard mints a short-lived signed URL when someone actually looks.
  id_doc_path  text,
  id_doc_type  text,                     -- 'aadhaar' | 'licence' | 'other'

  guest_id     uuid references public.guests(id) on delete set null,
  tz           text,
  user_agent   text,
  status       text not null default 'new'
               check (status in ('new','verified','flagged'))
);

-- ONE CHECK-IN PER PHONE. This is the constraint the whole "validated and can
-- only be used once" requirement rests on: enforce it in the database, because
-- a check in the browser is advisory and a check in the function still races
-- against a double-submit. The Edge Function turns the clash into a friendly
-- reply rather than an error.
create unique index if not exists checkins_phone_key on public.checkins (phone);
create unique index if not exists checkins_email_key on public.checkins (lower(email));
create index if not exists checkins_created_idx on public.checkins (created_at desc);

-- ------------------------------------------------------------ rate limiting
-- Reuses public.submit_log from schema.sql with kind='checkin'.

-- ------------------------------------------------- the failure log
-- submit_log doubles as the record of submissions that DIDN'T land. A rejected
-- application leaves no row in `applications` by definition, so without this a
-- failure is invisible: the applicant sees the Sheet succeed and the dashboard
-- simply never mentions them. `note` carries the reason.
alter table public.submit_log add column if not exists note text;

-- and let the dashboard read it. schema.sql deliberately gave submit_log no
-- policy at all, which was right while it held nothing but IP hashes; now that
-- it records why a submission failed, someone has to be able to look.
alter table public.submit_log enable row level security;
drop policy if exists "admins read submit_log" on public.submit_log;
create policy "admins read submit_log" on public.submit_log
  for select to authenticated using (public.is_admin());

-- ============================================================================
--  Row Level Security
-- ============================================================================
alter table public.guests   enable row level security;
alter table public.checkins enable row level security;

drop policy if exists "admins read guests"     on public.guests;
drop policy if exists "admins write guests"    on public.guests;
drop policy if exists "admins delete guests"   on public.guests;
drop policy if exists "admins read checkins"   on public.checkins;
drop policy if exists "admins update checkins" on public.checkins;
drop policy if exists "admins delete checkins" on public.checkins;

create policy "admins read guests" on public.guests
  for select to authenticated using (public.is_admin());
-- the dashboard pastes the roster in, so admins need insert + delete here
create policy "admins write guests" on public.guests
  for insert to authenticated with check (public.is_admin());
create policy "admins delete guests" on public.guests
  for delete to authenticated using (public.is_admin());

create policy "admins read checkins" on public.checkins
  for select to authenticated using (public.is_admin());
create policy "admins update checkins" on public.checkins
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Deletion is a feature here, not a risk: the privacy policy promises ID
-- documents are gone within 30 days, and a promise that needs a SQL console to
-- keep is a promise that gets forgotten. The dashboard deletes the document and
-- the row together.
create policy "admins delete checkins" on public.checkins
  for delete to authenticated using (public.is_admin());

-- ============================================================================
--  Storage — the ID documents
-- ============================================================================
-- private bucket: `public` false is the whole point, see the header note.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-ids', 'checkin-ids', false, 8388608,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

-- Only admins may read the objects. Writes come from the Edge Function, which
-- uses the service role and bypasses these policies entirely — so there is
-- deliberately NO insert policy for anon or authenticated.
drop policy if exists "admins read id docs" on storage.objects;
create policy "admins read id docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'checkin-ids' and public.is_admin());

-- and delete them, so an ID document never outlives the check-in it belongs to
drop policy if exists "admins delete id docs" on storage.objects;
create policy "admins delete id docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'checkin-ids' and public.is_admin());

-- ============================================================================
--  Realtime — so the dashboard fills in as people check in
-- ============================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.checkins';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.guests';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================================
--  TEAM & VENDORS
--  The people working the party, as opposed to the people coming to it. Kept out
--  of `guests` on purpose: guests have invite codes and sealed greetings, crew
--  have a headcount and a bed. One row can cover several people — a catering
--  company is one entry and six humans — which is why `headcount` exists rather
--  than six near-identical rows.
--  Admin-only in both directions. Nothing on the public site reads or writes it.
-- ============================================================================
create table if not exists public.crew (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  kind       text not null default 'team' check (kind in ('team','vendor')),
  role       text,                      -- photographer, catering, security…
  headcount  smallint not null default 1 check (headcount between 1 and 99),
  staying    boolean not null default true,   -- everyone in this table stays over
  notes      text
);
create index if not exists crew_kind_idx on public.crew (kind, name);

alter table public.crew enable row level security;

drop policy if exists "admins read crew"   on public.crew;
drop policy if exists "admins write crew"  on public.crew;
drop policy if exists "admins update crew" on public.crew;
drop policy if exists "admins delete crew" on public.crew;
create policy "admins read crew"   on public.crew for select to authenticated using (public.is_admin());
create policy "admins write crew"  on public.crew for insert to authenticated with check (public.is_admin());
create policy "admins update crew" on public.crew for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete crew" on public.crew for delete to authenticated using (public.is_admin());

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.crew';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================================
--  SITE META — the wording the outside world sees
--  A single row (id is pinned to 1) holding the title, the description and the
--  card's alt text. This is NOT what the live site serves: crawlers read the
--  static HTML in index.html and never run our JavaScript, so these tags cannot
--  be applied from the browser. The row is the source of truth for what the
--  wording SHOULD be, and the admin panel turns it into a block to commit.
-- ============================================================================
create table if not exists public.site_meta (
  id          smallint primary key default 1 check (id = 1),
  title       text,        -- <title>: the searchable words, for Google
  og_title    text,        -- og:/twitter:title: the short one, for a narrow card
  description text,
  og_alt      text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.site_meta enable row level security;

drop policy if exists "admins read meta"   on public.site_meta;
drop policy if exists "admins write meta"  on public.site_meta;
drop policy if exists "admins update meta" on public.site_meta;
create policy "admins read meta"   on public.site_meta for select to authenticated using (public.is_admin());
create policy "admins write meta"  on public.site_meta for insert to authenticated with check (public.is_admin());
create policy "admins update meta" on public.site_meta for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
--  THE LATE LIST — /late, the DM for people who arrive after applications close
--  One email per person, deduped case-insensitively. Writes only through the
--  waitlist Edge Function (rate-limited per IP and per visitor, logged in
--  submit_log with kind='waitlist'); the anon key reads zero rows. Reads are
--  admin-only, and there is deliberately no delete policy — an email given for
--  "a special surprise" is a promise, not a row to tidy.
--  visits.reached also gains 'late_landed' / 'late_submitted' so the dashboard
--  can see how many late arrivals leave an email.
-- ============================================================================
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email      text not null,
  session_id text,
  source     text,
  user_agent text
);
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
drop policy if exists "admins read waitlist" on public.waitlist;
create policy "admins read waitlist" on public.waitlist for select to authenticated using (public.is_admin());

alter table public.visits drop constraint if exists visits_reached_check;
alter table public.visits add constraint visits_reached_check check (reached in
  ('landed','entered','opened_dm','started_form','submitted',
   'q1','q2','q3','q4','q5','q6','q7','q8','late_landed','late_submitted'));

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.waitlist';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================================
--  DRAFTS — the application, saved answer by answer
--  One row per session, replaced with the latest snapshot at every answered
--  question, so a fall-out at question five still leaves four answers. The
--  Google Sheet keeps its exit-beacon partial row ("incomplete (n/8)"); this is
--  the copy that doesn't depend on the tab dying gracefully. `converted` flips
--  when the final submit succeeds, so the dashboard shows pure fall-out.
--  Writes only through the draft Edge Function (whitelisted fields, hard caps,
--  new sessions rate-limited per IP via submit_log kind='draft'); admin-only
--  reads; anon sees zero rows.
-- ============================================================================
create table if not exists public.drafts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  session_id text not null unique,
  visitor_id text,
  last_step  smallint not null default 0,
  answers    jsonb not null default '{}'::jsonb,
  source     text,
  user_agent text,
  converted  boolean not null default false
);

alter table public.drafts enable row level security;
drop policy if exists "admins read drafts" on public.drafts;
create policy "admins read drafts" on public.drafts for select to authenticated using (public.is_admin());

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.drafts';
  exception when duplicate_object then null; end;
end $$;
