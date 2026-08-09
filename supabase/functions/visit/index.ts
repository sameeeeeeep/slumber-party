// ============================================================================
//  POST /functions/v1/visit — funnel breadcrumbs for the dashboard.
//
//  One row per session per step: landed → entered → opened_dm → started_form →
//  submitted. That's what turns "142 applications" into "1,400 people landed and
//  142 finished", and shows you where they fall out.
//
//  No IP is stored, no cookie is set, no fingerprint is taken. `session_id` is a
//  random value the browser keeps in sessionStorage and forgets when the tab
//  closes; `tz` is the IANA timezone the browser already reports. Nothing here
//  identifies a person, which is why the site needs no tracking banner.
//
//  Deploy: supabase functions deploy visit
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

/* q1…q8 are the individual application questions. "started_form" only ever said
   that someone began; it couldn't say where they stopped, which is the thing worth
   knowing about a form that loses people. The existing per-(session, reached)
   dedupe means each session contributes at most one row per question, so the cost
   of this is bounded at eight extra rows per applicant.
   Kept in step with the check constraint on visits.reached — a value missing from
   either side is silently dropped. */
const STEPS = new Set([
  'landed', 'entered', 'opened_dm', 'started_form', 'submitted',
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
]);

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors(origin) });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return new Response('bad json', { status: 400, headers: cors(origin) }); }

  const session_id = str(b.session_id, 64);
  const reached = str(b.reached, 20) ?? 'landed';
  if (!session_id || !STEPS.has(reached)) {
    return new Response('bad request', { status: 400, headers: cors(origin) });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // one row per (session, step) — a reload shouldn't inflate the numbers
  const { data: seen } = await db
    .from('visits').select('id')
    .eq('session_id', session_id).eq('reached', reached).limit(1);
  if (seen && seen.length) return new Response('ok', { headers: cors(origin) });

  await db.from('visits').insert({
    session_id,
    reached,
    tz: str(b.tz, 60),
    referrer: str(b.referrer, 300),
    device: str(b.device, 20),
    /* The browser classifies its own source and sends the label; the raw UA comes
       too so a misclassification can be re-derived later without losing the visit.
       In-app browsers (Instagram, Threads, Snapchat…) announce themselves in the
       UA, which is the only reason social traffic can be attributed at all —
       referrers are stripped on almost every social tap. */
    source: str(b.source, 40),
    user_agent: str(b.user_agent, 300),
  });

  return new Response('ok', { headers: cors(origin) });
});
