// ============================================================================
//  POST /functions/v1/draft — the application, saved as it happens.
//
//  The form already leaves a partial row in the Google Sheet when the tab hides,
//  but that beacon depends on the tab dying gracefully — a killed app or a dead
//  battery takes the answers with it. So every answered question also lands
//  here, immediately: one row per session, replaced with the latest snapshot on
//  each step. Whoever falls out at question five still left four answers.
//
//  A duplicate session is an UPDATE, not a new row, so eight steps cost one row.
//  Only the eight known fields are accepted, each with a hard length cap —
//  everything else in the payload is dropped on the floor.
//
//  `converted: true` is the final submit telling us this draft became a real
//  application, so the dashboard can show fall-outs and only fall-outs.
//
//  Deploy: supabase functions deploy draft
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

// new sessions per IP per hour — updates to an existing session are uncounted,
// so this is "how many people may START applying behind one carrier-NAT IP"
const MAX_NEW_PER_IP_PER_HOUR = 500;

// the application's eight fields, and nothing else
const FIELDS: Record<string, number> = {
  name: 80, age: 12, city: 80, role: 40,
  handle: 60, phone: 20, email: 254, why: 1200,
};

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: cors(origin) });
  }

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers: cors(origin) });
  }

  const session_id = str(b.session_id, 64);
  if (!session_id) {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers: cors(origin) });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: existing } = await db.from('drafts')
    .select('id,last_step').eq('session_id', session_id).limit(1);
  const known = existing && existing[0];

  // the final submit marking its draft as become-real — no answers needed
  if (b.converted === true) {
    if (known) await db.from('drafts').update({ converted: true }).eq('id', known.id);
    return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
  }

  // whitelist + cap the snapshot
  const raw = (b.answers && typeof b.answers === 'object') ? b.answers as Record<string, unknown> : {};
  const answers: Record<string, string> = {};
  for (const k of Object.keys(FIELDS)) {
    const v = str(raw[k], FIELDS[k]);
    if (v) answers[k] = v;
  }
  if (!Object.keys(answers).length) {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers: cors(origin) });
  }
  const step = Math.max(0, Math.min(8, Number(b.step) || 0));

  if (known) {
    await db.from('drafts').update({
      answers,
      last_step: Math.max(step, known.last_step || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', known.id);
    return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
  }

  // a NEW session: this is the only path that costs a row, so it's the one rate-limited
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('draft:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_NEW_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false }), { status: 429, headers: cors(origin) });
  }
  await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'draft' });

  await db.from('drafts').insert({
    session_id,
    visitor_id: str(b.visitor_id, 64),
    last_step: step,
    answers,
    source: str(b.source, 40),
    user_agent: str(b.user_agent, 300),
  });
  return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
});
