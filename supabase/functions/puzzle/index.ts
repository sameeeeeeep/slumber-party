// ============================================================================
//  POST /functions/v1/puzzle — the puzzle reveal.
//
//  One picture, cut into a grid, handed out a piece at a time as people tap. The
//  wall assembles it live; when the last piece lands the image goes full-bleed
//  and the room is looking at the announcement.
//
//  Guests do exactly one thing: tap. They never receive the image — the piece
//  appears on the WALL with their name on it, not on their phone. That's leak-
//  proof and better theatre: forty people looking up instead of down.
//
//  Actions
//    open   — the guest word, the roster, and whether a puzzle is live
//    claim  — take the next unclaimed piece (atomic; see claim_piece())
//    board  — every placed piece, for the wall to draw
//    admin  — reset / reveal-all, behind the dashboard's own session token
//
//  Deploy: supabase functions deploy puzzle
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_TRIES_PER_IP_PER_HOUR = 60;
const MAX_PIECES_EACH = 6;        // one tap is one piece; this stops a hoarder

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/* the same guest word as the rest of the party pages — one derivation */
async function pbkdf2Hex(word: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('ssp-itinerary-pass'), iterations: 100000, hash: 'SHA-256' },
    base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const PUBLIC_BASE = Deno.env.get('SUPABASE_URL')! + '/storage/v1/object/public/puzzle/';

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
  const action = typeof b.action === 'string' ? b.action : 'board';
  const send = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: cors(origin) });

  /* ----------------------------------------------------------------- admin */
  const ADMIN = ['reset', 'revealAll'];
  if (ADMIN.includes(action)) {
    const token = (req.headers.get('x-admin-token') || '').trim();
    if (!token) return send({ ok: false, error: 'auth' }, 401);
    const who = await db.auth.getUser(token);
    const uid = who.data?.user?.id;
    if (!uid) return send({ ok: false, error: 'auth' }, 401);
    const admin = await db.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
    if (!admin.data) return send({ ok: false, error: 'auth' }, 403);

    const pid = typeof b.puzzle === 'string' ? b.puzzle : '';
    if (!pid) return send({ ok: false, error: 'bad' }, 400);

    if (action === 'reset') {
      const { error } = await db.from('puzzle_pieces')
        .update({ claimed_by: null, claimed_at: null }).eq('puzzle_id', pid);
      return error ? send({ ok: false, error: error.message }, 500) : send({ ok: true });
    }
    /* reveal-all: one guest in the loo shouldn't hold the room hostage */
    const { error } = await db.from('puzzle_pieces')
      .update({ claimed_by: 'the room', claimed_at: new Date().toISOString() })
      .eq('puzzle_id', pid).is('claimed_by', null);
    return error ? send({ ok: false, error: error.message }, 500) : send({ ok: true });
  }

  /* ------------------------------------------------------------ guest gate */
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('puzzle:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return send({ ok: false, error: 'rate' }, 429);
  }
  // only FAILED checks are logged — the wall polls this endpoint constantly
  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'puzzle' });
    return send({ ok: false, error: 'wrong' }, 401);
  }

  const { data: live } = await db.from('puzzles').select('*').eq('live', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  /* ------------------------------------------------------------------ open */
  if (action === 'open') {
    const { data } = await db.from('guests').select('id,name')
      .not('code', 'is', null).order('name');
    return send({
      ok: true,
      roster: (data || []).map((g) => String(g.name).replace(/\(.*?\)/g, '').trim()),
      puzzle: live ? { id: live.id, name: live.name } : null,
    });
  }

  if (!live) return send({ ok: true, puzzle: null, pieces: [], total: 0, placed: 0 });

  /* ----------------------------------------------------------------- claim */
  if (action === 'claim') {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    if (!name) return send({ ok: false, error: 'name' }, 400);

    const { count: mine } = await db.from('puzzle_pieces')
      .select('id', { count: 'exact', head: true })
      .eq('puzzle_id', live.id).eq('claimed_by', name);
    if ((mine ?? 0) >= MAX_PIECES_EACH) return send({ ok: false, error: 'enough' }, 429);

    /* the atomic bit lives in Postgres, not here: FOR UPDATE SKIP LOCKED means
       forty simultaneous taps take forty different pieces */
    const { data, error } = await db.rpc('claim_piece', { p_puzzle: live.id, p_name: name });
    if (error) return send({ ok: false, error: 'save' }, 500);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return send({ ok: false, error: 'done' });      // the picture is complete
    return send({ ok: true, idx: row.idx, total: row.total, placed: row.placed });
  }

  /* ----------------------------------------------------------------- board */
  const { data: pieces } = await db.from('puzzle_pieces')
    .select('idx,claimed_by,claimed_at').eq('puzzle_id', live.id)
    .not('claimed_by', 'is', null).order('claimed_at');
  const placed = pieces || [];
  const { count: total } = await db.from('puzzle_pieces')
    .select('id', { count: 'exact', head: true }).eq('puzzle_id', live.id);

  const mine = typeof b.name === 'string' ? b.name.trim() : '';
  return send({
    ok: true,
    puzzle: {
      id: live.id, name: live.name, cols: live.cols, rows: live.rows,
      /* the wall needs the image; a guest's phone never asks for this because it
         never draws the picture */
      url: live.image_path ? PUBLIC_BASE + live.image_path : null,
    },
    pieces: placed.map((p) => ({ idx: p.idx, by: String(p.claimed_by).split(/\s+/)[0], at: p.claimed_at })),
    total: total ?? 0,
    placed: placed.length,
    people: new Set(placed.map((p) => p.claimed_by)).size,
    mine: mine ? placed.filter((p) => p.claimed_by === mine).map((p) => p.idx) : [],
  });
});
