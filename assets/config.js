/* ============================================================================
   Shared config for the site and the /admin dashboard.

   BOTH VALUES BELOW ARE SAFE TO COMMIT. Supabase's anon key is designed to sit
   in public JavaScript — it is not a password. It grants nothing on its own:
   Row Level Security refuses every read, and applications can only be written
   through the Edge Function, which validates and rate-limits. See
   supabase/schema.sql for the policies that make that true.

   The SERVICE ROLE key is the opposite — it bypasses RLS entirely. It belongs
   only in `supabase secrets set`, never in this file and never in the repo.
   ============================================================================ */
window.SLUMBER_CONFIG = {
  // Supabase → Project Settings → API → "Project URL"
  supabaseUrl: 'https://secseoyetyfqsfgzlnis.supabase.co',

  // Supabase → Project Settings → API → "Project API keys" → publishable / anon.
  // Verified inert against this project: it reads zero rows from every table and
  // its writes are refused with a row-level-security violation (42501).
  supabaseAnonKey: 'sb_publishable_eyh8o8PCrMBfjZ0199Ki4A_cyKjbXJZ',

  // ON — submit + visit + checkin are all deployed (7 Aug 2026). Applications now
  // write to BOTH: the Google Form as before, and Supabase for the live dashboard.
  // Visit pings also start flowing, which is what fills the funnel and the
  // live-visitor count. Set back to false to fall out of Supabase entirely; the
  // Google Form keeps working either way, which is the point of keeping both.
  useSupabase: true,

  // Keep writing to the Google Form as well during the migration, so nothing
  // is lost while we cut over. Set to false once Supabase has been running
  // cleanly for a few days.
  alsoPostGoogleForm: true,

  /* ------------------------------------------------------- the deadline
     WHEN APPLICATIONS CLOSE. THIS IS NOT THE PARTY DATE, AND THE PARTY DATE
     MUST NEVER BE PUT HERE — this file is world-readable, and the party's
     real dates exist only as ciphertext in besties/sealed.js. A date pasted
     here would undo that quietly, with nothing on screen to show it.

     Two pages read this and nothing else: the gate's countdown on / , and
     the "you just missed it" lines on /late that name the hour out loud.
     Move it here and they both move with it.

     +05:30 is load-bearing, not decoration. Without an offset the string is
     parsed in the VIEWER's timezone, so the same deadline passed at midnight
     in London hours after it passed in Mumbai. The party is IST, so the
     deadline is IST for everyone, wherever they're reading from. */
  /* CLOSED. Was 18 Aug 12 noon IST; brought forward to 17 Aug, 2:21pm IST — the
     moment it was actually called. The gate now reads "applications are closed"
     and sends everyone to /late, where she says the hour this names. To reopen,
     put a future time here; nothing else needs touching. */
  formCloses: '2026-08-17T14:21:00+05:30',   // 17 Aug 2026, 2:21pm IST

  /* ---------------------------------------------------------------- /besties
     The private invitation. Note what is NOT here: the password, the dates, the
     location, the chat script. All of that lives encrypted in besties/sealed.js
     and is only ever decrypted in the guest's browser, because this file — like
     everything else on a static site — is world-readable.

     To change any of it:  edit besties/content.json
                           node tools/besties-seal.mjs seal
     To change the password:  node tools/besties-seal.mjs seal --pass=NEWWORD
                              (then re-run `guests` so personal links keep working)

     There is deliberately no RSVP form and no guest data collection: tapping
     "I'M COMING" is a single confirmation, and everything else (numbers, food,
     travel) happens in the real group chat she adds people to afterwards. So
     there is nothing to configure here yet — the block exists as the hook for
     when there is.
     ------------------------------------------------------------------------- */
  besties: {},
};
