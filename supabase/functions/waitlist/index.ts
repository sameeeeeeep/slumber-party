// ============================================================================
//  POST /functions/v1/waitlist — the late-night list.
//
//  Applications close at midnight; this is where the people who missed it land.
//  One field, one row: an email, deduped case-insensitively. A duplicate is not
//  an error — it answers 200 with already:true so the chat can say "you're
//  already on my list" instead of apologising for a constraint violation.
//
//  Same posture as submit: anon key can't read this table (RLS refuses), writes
//  only pass through here, rate-limited per IP and per visitor. Per-IP is
//  generous for the same carrier-NAT reason submit's is — one Jio IP is many
//  real phones — while per-visitor stays tight because one person needs to
//  leave one email, not forty.
//
//  Deploy: supabase functions deploy waitlist
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_PER_IP_PER_HOUR = 300;
const MAX_PER_VISITOR_PER_HOUR = 5;

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

// the pragmatic email shape — one @, something either side, a dot after
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    return new Response(JSON.stringify({ ok: false, error: 'bad json' }), { status: 400, headers: cors(origin) });
  }

  const email = (str(b.email, 254) || '').toLowerCase();
  if (!EMAIL.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad email' }), { status: 400, headers: cors(origin) });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // rate limits — the IP is hashed for the window check and never stored
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('waitlist:' + ip);
  const vid = str(b.visitor_id, 64);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { count: ipCount } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((ipCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }
  // same column names submit uses: hashed visitor id lives in `vid`
  const vidHash = vid ? await sha256('waitlist-vid:' + vid) : null;
  if (vidHash) {
    const { count: vidCount } = await db.from('submit_log')
      .select('id', { count: 'exact', head: true })
      .eq('vid', vidHash).gte('created_at', hourAgo);
    if ((vidCount ?? 0) >= MAX_PER_VISITOR_PER_HOUR) {
      return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
    }
  }
  await db.from('submit_log').insert({ ip_hash: ipHash, vid: vidHash, kind: 'waitlist' });

  const { error } = await db.from('waitlist').insert({
    email,
    session_id: str(b.session_id, 64),
    source: str(b.source, 40),
    user_agent: str(b.user_agent, 300),
  });

  if (error) {
    // 23505 = the unique index: they're already on the list, which is a happy path
    if ((error as { code?: string }).code === '23505') {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: cors(origin) });
    }
    return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500, headers: cors(origin) });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: cors(origin) });
});
