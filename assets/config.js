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
  supabaseUrl: '',

  // Supabase → Project Settings → API → "Project API keys" → anon / public
  supabaseAnonKey: '',

  // While false, the site keeps posting to the Google Form only and the
  // Supabase calls are skipped — so filling in the two values above is what
  // switches the new backend on. Set to false to fall back instantly.
  useSupabase: true,

  // Keep writing to the Google Form as well during the migration, so nothing
  // is lost while we cut over. Set to false once Supabase has been running
  // cleanly for a few days.
  alsoPostGoogleForm: true,
};
