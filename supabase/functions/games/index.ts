// ============================================================================
//  POST /functions/v1/games — the Slumber Games leaderboard.
//
//  Read by guests on their phones AND projected on a screen at the party, so it
//  answers one question completely in one call: where every house stands, why,
//  and who is in them.
//
//  Standings are summed from the ledger here rather than kept as a total on the
//  house row. The ledger is the truth; a cached total is a second truth waiting
//  to disagree with it at 1am when somebody disputes a score.
//
//  Behind the guest word, same as /house and /itinerary.
//  Deploy: supabase functions deploy games
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_TRIES_PER_IP_PER_HOUR = 40;

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

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('games:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }

  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'games' });
    return new Response(JSON.stringify({ ok: false, error: 'wrong' }), { status: 401, headers: cors(origin) });
  }

  const [houses, ledger, guests] = await Promise.all([
    db.from('houses').select('id,name,colour,sigil,motto,position').order('position'),
    db.from('points').select('house_id,points,reason,game,created_at').order('created_at', { ascending: false }),
    // first names only: the leaderboard goes on a screen in a room, and a roster
    // is all it needs from the guest list
    db.from('guests').select('name,house_id').not('code', 'is', null).order('name'),
  ]);
  if (houses.error) {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: cors(origin) });
  }

  const rows = houses.data || [];
  const led = ledger.data || [];
  const people = guests.data || [];

  const table = rows.map((h) => {
    const mine = led.filter((p) => p.house_id === h.id);
    return {
      id: h.id, name: h.name, colour: h.colour, sigil: h.sigil || '', motto: h.motto || '',
      total: mine.reduce((n, p) => n + (p.points || 0), 0),
      roster: people.filter((g) => g.house_id === h.id)
        .map((g) => String(g.name).replace(/\(.*?\)/g, '').trim().split(/\s+/)[0]),
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  /* The last twenty awards, newest first — the "why" behind the standings, which
     is the whole reason the ledger exists. */
  const feed = led.slice(0, 20).map((p) => {
    const h = rows.find((x) => x.id === p.house_id);
    return { house: h ? h.name : '—', colour: h ? h.colour : '#eb648c',
             points: p.points, reason: p.reason || p.game || '', at: p.created_at };
  });

  const unassigned = people.filter((g) => !g.house_id).length;

  return new Response(JSON.stringify({ ok: true, table, feed, unassigned }), { headers: cors(origin) });
});
