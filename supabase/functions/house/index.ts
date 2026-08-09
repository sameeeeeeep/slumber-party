// ============================================================================
//  POST /functions/v1/house — who's at the party, for the guest world.
//
//  Behind the same word as /itinerary, on purpose: guests should have ONE thing
//  to remember, and both pages are for the same people on the same weekend. The
//  word is compared as a PBKDF2 derivation, never in plaintext — see the
//  itinerary function for the full reasoning.
//
//  WHAT THIS DELIBERATELY DOES NOT RETURN. The guests table also holds home
//  addresses, invite codes, phone numbers and check-in records. This endpoint is
//  read by every guest, so it selects a hand-written column list rather than
//  `*`: name, blurb, instagram, sprite, room, tier. Adding a column to the table
//  can therefore never quietly publish it to the whole party.
//
//  Deploy: supabase functions deploy house
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_TRIES_PER_IP_PER_HOUR = 30;

// the rooms a guest can be placed in; anything else falls back to the fort
const ROOMS = ['fort', 'nails', 'terrace', 'arcade'];

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

/* Same salt and rounds as the itinerary secret — one guest word, one derivation. */
async function pbkdf2Hex(word: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('ssp-itinerary-pass'), iterations: 100000, hash: 'SHA-256' },
    base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* A stable sprite for someone with no chosen one, from their name — so the house
   is populated the moment guests exist, without waiting for anyone to fill a
   field in. Same name always lands on the same character. */
function spriteFor(name: string, count = 8) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % count;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: cors(origin) });
  }

  const REAL_HASH = Deno.env.get('ITINERARY_HASH');
  if (!REAL_HASH) {
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

  // only wrong guesses count, so a guest reloading the house can't lock themselves out
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('house:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }

  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'house' });
    return new Response(JSON.stringify({ ok: false, error: 'wrong' }), { status: 401, headers: cors(origin) });
  }

  // the hand-written column list is the privacy boundary — never `*`
  const { data, error } = await db.from('guests')
    .select('name,blurb,instagram,sprite,room,tier')
    .not('code', 'is', null)              // roster-only names aren't attending
    .order('name');
  if (error) {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: cors(origin) });
  }

  const people = (data || []).map((g, i) => {
    const name = String(g.name || '').trim();
    // strip a parenthetical — "Khushi Sarnot (Syera)" walks around as "Khushi"
    const first = name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || 'guest';
    const ig = String(g.instagram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
    return {
      id: i,                                       // positional only; no database id leaves here
      name, first,
      blurb: g.blurb ? String(g.blurb).slice(0, 240) : null,
      instagram: ig || null,
      sprite: Number.isInteger(g.sprite) ? g.sprite : spriteFor(name),
      room: ROOMS.includes(String(g.room)) ? String(g.room) : ROOMS[i % ROOMS.length],
      tier: g.tier || 'bestie',
    };
  });

  return new Response(JSON.stringify({ ok: true, people }), { headers: cors(origin) });
});
