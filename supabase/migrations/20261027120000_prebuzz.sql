-- ============================================================================
--  PREBUZZ — the chat that runs on / before Khushi's launch.
--
--  Two kinds of visitor, two tables:
--    · strangers leave their details      → prebuzz_leads
--    · slumber applicants type their phone → prebuzz_members (one row per phone)
--
--  WHAT MAKES THE SECRET CHAT SECRET. This site is static and its repo is
--  public, so nothing that belongs to the secret chat may live in HTML, JS or
--  the Edge Function source: not the coupon code, not the discount, not her
--  lines. All of it sits in prebuzz_settings, which RLS hides from the anon
--  key, and only /functions/v1/prebuzz reads it — after a phone has matched a
--  row in `applications`. Edit the copy here, not in code:
--
--      update public.prebuzz_settings set value = jsonb_set(value, '{coupon}', '"NEWCODE"')
--       where key = 'secret';
--
--  THE ONE CODE, BOUND TO PHONES. Every applicant gets the same code. It is
--  only worth anything at a checkout that sends code + phone to the function's
--  `redeem` action, which checks the phone applied and has not used it yet,
--  then stamps prebuzz_members.coupon_redeemed_at. A leaked code is useless
--  without a registered phone that hasn't redeemed.
--
--  Safe to re-run.
-- ============================================================================

-- the lookup the whole flow turns on: applications.phone is stored '+91 XXXXXXXXXX'
create index if not exists applications_phone_idx on public.applications (phone);

-- ------------------------------------------------------------------- strangers
create table if not exists public.prebuzz_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null,          -- '+91 XXXXXXXXXX', same shape as applications
  email       text,
  handle      text,
  city        text,
  guess       text,                   -- "what do you think i'm building?"
  source      text,
  tz          text,
  user_agent  text
);
create unique index if not exists prebuzz_leads_phone_key on public.prebuzz_leads (phone);
create index if not exists prebuzz_leads_created_at_idx on public.prebuzz_leads (created_at desc);

-- ---------------------------------------------------------------- applicants
create table if not exists public.prebuzz_members (
  phone               text primary key,          -- '+91 XXXXXXXXXX'
  application_id      uuid references public.applications(id) on delete set null,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  coupon_redeemed_at  timestamptz,
  coupon_order_ref    text,
  photos_viewed_at    timestamptz,
  hamper_post_url     text,
  hamper_submitted_at timestamptz,
  hamper_status       text not null default 'none'
                      check (hamper_status in ('none','entered','won','lost'))
);
create index if not exists prebuzz_members_hamper_idx on public.prebuzz_members (hamper_status, hamper_submitted_at desc);

-- A phone match hands the browser a random token; only its hash is kept.
create table if not exists public.prebuzz_sessions (
  token_hash  text primary key,
  phone       text not null references public.prebuzz_members(phone) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists prebuzz_sessions_phone_idx on public.prebuzz_sessions (phone);

-- ------------------------------------------------------------------ the copy
create table if not exists public.prebuzz_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Placeholder copy — EDIT BEFORE LAUNCH. `lines` are her messages in the
-- secret chat, in order. `coupon` is the one shared code and `discount` what
-- it's worth; both are deliberately null HERE because this file is public.
-- Set them in the SQL editor, never in a committed file:
--   update public.prebuzz_settings
--      set value = value || '{"coupon":"YOURCODE","discount":"30% off"}'::jsonb
--    where key = 'secret';
-- Until coupon is set the card doesn't show and redeem refuses every code.
insert into public.prebuzz_settings (key, value) values ('secret', jsonb_build_object(
  'coupon',   null,
  'discount', null,
  'lines', jsonb_build_array(
    'wait. YOU 🥹',
    'okay you were there from the start, so you get the secret chat',
    'the thing i''ve been building is almost here. you see it before anyone',
    'early access + a discount nobody else gets. it only works with your number'
  ),
  'photos_line', 'and because you applied — a few photos from the night. you get to look ONCE 👀',
  'hamper_line', 'last thing: post about the slumber party on your story or feed, tag me, and paste the link here. a few of you get a hamper from me 🎀',
  'hamper_tag',  '@khushikapoor'
))
on conflict (key) do nothing;

-- ============================================================================
--  Row Level Security — same posture as schema.sql: anon gets nothing, the
--  function writes with the service role, admins read from /admin.
-- ============================================================================
alter table public.prebuzz_leads    enable row level security;
alter table public.prebuzz_members  enable row level security;
alter table public.prebuzz_sessions enable row level security;
alter table public.prebuzz_settings enable row level security;

drop policy if exists "admins read prebuzz leads"     on public.prebuzz_leads;
drop policy if exists "admins read prebuzz members"   on public.prebuzz_members;
drop policy if exists "admins update prebuzz members" on public.prebuzz_members;
drop policy if exists "admins read prebuzz settings"  on public.prebuzz_settings;
drop policy if exists "admins update prebuzz settings" on public.prebuzz_settings;

create policy "admins read prebuzz leads" on public.prebuzz_leads
  for select to authenticated using (public.is_admin());
create policy "admins read prebuzz members" on public.prebuzz_members
  for select to authenticated using (public.is_admin());
-- so hamper winners can be marked from the dashboard
create policy "admins update prebuzz members" on public.prebuzz_members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read prebuzz settings" on public.prebuzz_settings
  for select to authenticated using (public.is_admin());
create policy "admins update prebuzz settings" on public.prebuzz_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- prebuzz_sessions: no policy at all. Only the function touches it.

-- ------------------------------------------------------------------ the photos
-- Private bucket: no public URLs, no anon policies. The function lists it and
-- hands out 90-second signed URLs, once per phone. Upload the photos in
-- Supabase → Storage → prebuzz-photos.
insert into storage.buckets (id, name, public)
values ('prebuzz-photos', 'prebuzz-photos', false)
on conflict (id) do nothing;
