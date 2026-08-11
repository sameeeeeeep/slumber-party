// ============================================================================
//  POST /functions/v1/never — never have I ever, played by a room at once.
//
//  One question is live at a time. Every phone shows it with two buttons, and
//  every answer lands on the projected wall as a name bubble on the side it
//  chose. The wall is the game; the phone is just the button.
//
//  An answer is CHANGEABLE. It upserts onto (q_id, name), so tapping the wrong
//  side isn't fatal — the bubble slides across the wall, which is funnier than
//  getting it right first time. Nothing here is ever deleted by a guest.
//
//  Actions
//    open   — the guest word, the roster, and the live question
//    answer — { name, answer:'have'|'never' } on whatever is live
//    board  — the live question, every answer, and the running tallies
//
//  There is no admin action. The dashboard writes questions and moves the live
//  pointer with its own authenticated session under is_admin() policies, so
//  there's no second code path to keep honest.
//
//  Deploy: supabase functions deploy never
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

// the wall polls this endpoint, and a round is forty taps in a minute or two, so
// this is set to stop a script rather than to pace a game
const MAX_TRIES_PER_IP_PER_HOUR = 240;

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

  /* ------------------------------------------------------------ guest gate */
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('never:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return send({ ok: false, error: 'rate' }, 429);
  }
  // only FAILED checks are logged — the wall polls this endpoint constantly
  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'never' });
    return send({ ok: false, error: 'wrong' }, 401);
  }

  const { data: live } = await db.from('never_qs').select('id,text,position')
    .eq('live', true).maybeSingle();

  /* ------------------------------------------------------------------ open */
  if (action === 'open') {
    const { data } = await db.from('guests').select('id,name')
      .not('code', 'is', null).order('name');
    return send({
      ok: true,
      /* the bracketed bit in a guest's name is a note to us, not part of who they
         are — same trim as the nail board and the puzzle */
      roster: (data || []).map((g) => String(g.name).replace(/\(.*?\)/g, '').trim()),
      question: live ? { id: live.id, text: live.text } : null,
    });
  }

  /* ---------------------------------------------------------------- answer */
  if (action === 'answer') {
    if (!live) return send({ ok: false, error: 'none' });
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    const answer = b.answer === 'have' ? 'have' : b.answer === 'never' ? 'never' : '';
    if (!name || !answer) return send({ ok: false, error: 'bad' }, 400);
    /* the guest sends the question they were LOOKING AT. If the host has moved on
       since their thumb left the glass, the answer belongs to the old question and
       we say so, rather than silently filing it under the new one. */
    const forQ = typeof b.q === 'string' ? b.q : live.id;
    if (forQ !== live.id) return send({ ok: false, error: 'moved', question: { id: live.id, text: live.text } });

    const { error } = await db.from('never_answers')
      .upsert({ q_id: live.id, name, answer }, { onConflict: 'q_id,name' });
    if (error) return send({ ok: false, error: 'save' }, 500);
    return send({ ok: true, answer });
  }

  /* ----------------------------------------------------------------- board */
  if (!live) {
    return send({ ok: true, question: null, have: [], never: [], roster: 0, standings: [] });
  }
  const [{ data: rows }, { count: roster }, { data: all }] = await Promise.all([
    db.from('never_answers').select('name,answer,created_at')
      .eq('q_id', live.id).order('created_at'),
    db.from('guests').select('id', { count: 'exact', head: true }).not('code', 'is', null),
    /* every answer ever, for the running "who has done the most" line. Cheap: a
       night of this is a few hundred rows. */
    db.from('never_answers').select('name,answer'),
  ]);

  /* DISPLAY NAMES, and why they aren't just first names.
     The roster has two Khushis and two Tanishas. A wall that shows first names
     only would put both of them in one bubble — and worse, the wall keys its
     bubbles by what it's given, so one of the two would vanish and the other
     would flicker between the columns as each poll disagreed with the last. So:
     first name normally, first name plus last initial when that first name is
     shared by someone else who answered. The `k` is always the full name, which
     is what the wall keys on. */
  const shortOf = (full: string) => String(full).trim().split(/\s+/);
  const firstNames = new Map<string, Set<string>>();
  for (const r of rows || []) {
    const f = shortOf(r.name)[0].toLowerCase();
    if (!firstNames.has(f)) firstNames.set(f, new Set());
    firstNames.get(f)!.add(r.name);
  }
  const label = (full: string) => {
    const parts = shortOf(full);
    const clash = (firstNames.get(parts[0].toLowerCase())?.size ?? 0) > 1;
    return clash && parts[1] ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
  };
  const show = (r: { name: string }) => ({ k: r.name, n: label(r.name) });

  const first = (n: string) => String(n).split(/\s+/)[0];
  const tally = new Map<string, { have: number; total: number }>();
  for (const r of all || []) {
    const t = tally.get(r.name) || { have: 0, total: 0 };
    if (r.answer === 'have') t.have++;
    t.total++;
    tally.set(r.name, t);
  }

  return send({
    ok: true,
    question: { id: live.id, text: live.text },
    /* { k: the full name — what the wall keys a bubble on
         n: what it prints } */
    have:  (rows || []).filter((r) => r.answer === 'have').map(show),
    never: (rows || []).filter((r) => r.answer === 'never').map(show),
    answered: (rows || []).length,
    roster: roster ?? 0,
    /* the scoreboard: most "I have" first. Ties broken by how many questions they
       answered at all, so somebody who played every round outranks a lurker. */
    standings: [...tally].map(([name, t]) => ({
      /* the same clash rule over every answer of the night, so the leaderboard
         doesn't credit one Khushi with the other's confessions */
      name: [...tally.keys()].some((o) => o !== name &&
             first(o).toLowerCase() === first(name).toLowerCase())
        ? `${first(name)} ${(shortOf(name)[1] || '')[0] ? (shortOf(name)[1][0] + '.') : ''}`.trim()
        : first(name),
      have: t.have, of: t.total }))
      .sort((a, b) => b.have - a.have || b.of - a.of).slice(0, 8),
    /* my own answer, so a phone that reloads mid-round doesn't forget */
    mine: typeof b.name === 'string'
      ? ((rows || []).find((r) => r.name === String(b.name).trim())?.answer || null)
      : null,
  });
});
