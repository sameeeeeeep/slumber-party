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

  // OFF until the Edge Functions are deployed. While false the site posts to the
  // Google Form only and skips Supabase entirely — no failed-submit message, no
  // visit tracking, nothing written to Postgres. Flip to true the moment
  // `supabase functions deploy submit && supabase functions deploy visit` is done.
  useSupabase: false,

  // Keep writing to the Google Form as well during the migration, so nothing
  // is lost while we cut over. Set to false once Supabase has been running
  // cleanly for a few days.
  alsoPostGoogleForm: true,
};
