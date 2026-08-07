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
