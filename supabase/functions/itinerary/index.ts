// ============================================================================
//  POST /functions/v1/itinerary — the day's programme, behind the word.
//
//  Guests can't read the itinerary table (RLS refuses everything), so this is
//  the only door: send the password, get the visible items back. The password
//  lives in a Supabase secret — this repo is PUBLIC, so it cannot appear in
//  this file, and if the secret is unset the function fails closed rather than
//  open.
//
//  Wrong guesses are rate-limited per IP: this word gates the party's actual
//  programme, including the days it happens — the one thing the public site
//  never says.
//
//  The word is handled the way /besties handles its passwords: never stored and
//  never compared in plaintext. The secret holds only a PBKDF2-SHA256 derivation
//  (100,000 rounds, fixed salt — the same primitive and rounds as the besties
//  guest index), the submitted word is lowercased and derived the same slow way,
//  and the derivations are compared. Nowhere — code, secret store, or wire
//  handler — does the plain word exist at rest, and the 100k rounds make each
//  offline guess as expensive as besties makes theirs.
//
//  Deploy: supabase functions deploy itinerary
//  Secret: supabase secrets set ITINERARY_HASH=<pbkdf2 hex — see tools note>
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_TRIES_PER_IP_PER_HOUR = 30;

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

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Must mirror how the secret was derived — same salt, same rounds — or the
   right word stops opening the door. Matches the besties derivation discipline:
   PBKDF2-SHA256, 100k rounds, lowercased input. */
async function pbkdf2Hex(word: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('ssp-itinerary-pass'), iterations: 100000, hash: 'SHA-256' },
    base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: cors(origin) });
  }

  const REAL_HASH = Deno.env.get('ITINERARY_HASH');
  if (!REAL_HASH) {
    // fail closed: no secret means no door, not an open one
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers: cors(origin) });
  }

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers: cors(origin) });
  }
  const given = typeof b.password === 'string' ? b.password.trim().toLowerCase() : '';

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  /* Only WRONG guesses count against the limit. The guest page re-sends the
     word every minute to stay fresh — counting those polls as attempts locked
     out anyone who simply kept the programme open for half an hour, which is
     the page working as designed. Brute force is still bounded: thirty wrong
     words an hour per IP, and a correct word costs nothing. */
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('itinerary:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }

  // derive the submitted word the same slow way and compare derivations —
  // same length either way, no early exit on the first wrong byte
  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'itinerary' });
    return new Response(JSON.stringify({ ok: false, error: 'wrong' }), { status: 401, headers: cors(origin) });
  }

  const { data, error } = await db.from('itinerary')
    .select('day,t,emoji,title,detail,is_now')
    .eq('visible', true)
    .order('position', { ascending: true });
  if (error) {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: cors(origin) });
  }
  return new Response(JSON.stringify({ ok: true, items: data || [] }), { headers: cors(origin) });
});
