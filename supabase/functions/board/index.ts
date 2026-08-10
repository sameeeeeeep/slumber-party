// ============================================================================
//  POST /functions/v1/board — the nail board.
//
//  A 20-minute round: guests find nail designs on Pinterest, screenshot them,
//  and add them here; a projected wall fills up as they land. The point is not
//  the wall — it's the TAG on every upload, because a pile of screenshots can't
//  be counted and a tally can. What leaves the party is a ranked list of what
//  forty people actually chose.
//
//  Four actions, one door:
//    open   — the guest word plus the roster to pick a name from
//    add    — a resized screenshot + a tag, stored under the service role
//    board  — everything visible, newest first, with the tally and vote counts
//    vote   — up to VOTES_EACH favourites per person, one per post
//
//  Guests never touch the tables. There is no INSERT policy on either of them:
//  every write happens here, behind the word, with validation and a cap. The
//  bucket IS public-read, deliberately — the wall shows forty images for twenty
//  minutes and signed URLs expiring mid-round would blank it. Paths are random,
//  nothing links to them, and the bucket is meant to be emptied after the party.
//
//  Deploy: supabase functions deploy board
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

const MAX_TRIES_PER_IP_PER_HOUR = 60;
const MAX_POSTS_EACH = 12;        // generous; stops one phone filling the wall
const MAX_BYTES = 1_500_000;      // the page resizes to ~200KB, so this is slack
const VOTES_EACH = 3;

/* The styles the tally is built from. A free-text tag would give forty spellings
   of "chrome" and nothing to count, so the page offers these and the function
   refuses anything else. Change them here and in board/index.html together. */
const TAGS = [
  'chrome', 'french', 'cat-eye', 'glitter', 'bows', 'chocolate',
  'aura', 'polka', 'minimal', 'almond', 'short', 'other',
];

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
/* Same salt and rounds as the itinerary secret — one guest word, one derivation. */
async function pbkdf2Hex(word: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('ssp-itinerary-pass'), iterations: 100000, hash: 'SHA-256' },
    base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* The client sends a data URL because it has just resized the screenshot on a
   canvas and that is what canvas gives you. Decoded here rather than trusting a
   Content-Type: the bucket's mime list is the second gate, this is the first. */
function decodeDataUrl(s: unknown): { bytes: Uint8Array; ext: string } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const raw = atob(m[2]);
  if (raw.length > MAX_BYTES) return null;
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { bytes, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

// module scope on purpose: a client held in the handler loses its socket when
// the function returns, which is how /house's realtime channel died once
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const PUBLIC_BASE = Deno.env.get('SUPABASE_URL')! + '/storage/v1/object/public/board/';

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

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256('board:' + ip);

  /* Only FAILED checks are logged. The wall polls this endpoint every few
     seconds; counting every request would lock out the room in a minute, which
     is exactly how the itinerary locked itself out on the first day. */
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }
  const ADMIN_ACTIONS = ['hide', 'show', 'drop', 'clear'];
  if (!ADMIN_ACTIONS.includes(action) && await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'board' });
    return new Response(JSON.stringify({ ok: false, error: 'wrong' }), { status: 401, headers: cors(origin) });
  }

  const send = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: cors(origin) });

  /* ----------------------------------------------------------------- admin
     Moderation and clear-down. These are NOT behind the guest word — every
     guest at the party knows it, and "delete the whole board" is not something
     forty people should be one string away from. The caller has to present the
     dashboard's own session token and be a row in `admins`, which is the same
     bar as every other write in /admin. */
  if (action === 'hide' || action === 'show' || action === 'drop' || action === 'clear') {
    const token = (req.headers.get('x-admin-token') || '').trim();
    if (!token) return send({ ok: false, error: 'auth' }, 401);
    const who = await db.auth.getUser(token);
    const uid = who.data?.user?.id;
    if (!uid) return send({ ok: false, error: 'auth' }, 401);
    const admin = await db.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
    if (!admin.data) return send({ ok: false, error: 'auth' }, 403);

    const id = typeof b.post === 'string' ? b.post : '';
    if (action === 'hide' || action === 'show') {
      if (!id) return send({ ok: false, error: 'bad' }, 400);
      const { error } = await db.from('board_posts')
        .update({ hidden: action === 'hide' }).eq('id', id);
      return error ? send({ ok: false, error: error.message }, 500) : send({ ok: true });
    }
    if (action === 'drop') {
      if (!id) return send({ ok: false, error: 'bad' }, 400);
      const { data } = await db.from('board_posts').select('path').eq('id', id).maybeSingle();
      if (data?.path) await db.storage.from('board').remove([data.path]);
      const { error } = await db.from('board_posts').delete().eq('id', id);
      return error ? send({ ok: false, error: error.message }, 500) : send({ ok: true });
    }
    /* clear: the tables AND the bucket. It lists the bucket rather than reading
       paths out of the rows, so files orphaned by anything at all — a failed
       insert, a hand-deleted row — go too. This is the after-the-party button:
       the screenshots are other people's pictures and there is no reason to keep
       them once the tally exists. */
    let removed = 0;
    for (;;) {
      const { data } = await db.storage.from('board').list('', { limit: 100 });
      if (!data || !data.length) break;
      const names = data.map((f) => f.name);
      const { error } = await db.storage.from('board').remove(names);
      if (error) break;
      removed += names.length;
      if (names.length < 100) break;
    }
    await db.from('board_votes').delete().neq('post_id', '00000000-0000-0000-0000-000000000000');
    await db.from('board_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return send({ ok: true, removed });
  }

  /* ------------------------------------------------------------------ open */
  if (action === 'open') {
    // first names only: it's a picker, and the wall shows first names
    const { data } = await db.from('guests').select('id,name,tier')
      .not('code', 'is', null).order('name');
    return send({
      ok: true, tags: TAGS, votesEach: VOTES_EACH, maxPosts: MAX_POSTS_EACH,
      roster: (data || []).map((g) => ({ id: g.id, name: String(g.name).replace(/\(.*?\)/g, '').trim() })),
    });
  }

  /* ------------------------------------------------------------------- add */
  if (action === 'add') {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    const tag = typeof b.tag === 'string' ? b.tag.trim().toLowerCase() : '';
    const colour = typeof b.colour === 'string' ? b.colour.trim().slice(0, 40) || null : null;
    if (!name) return send({ ok: false, error: 'name' }, 400);
    if (!TAGS.includes(tag)) return send({ ok: false, error: 'tag' }, 400);

    const img = decodeDataUrl(b.image);
    if (!img) return send({ ok: false, error: 'image' }, 400);

    // one person can't bury the wall
    const { count: mine } = await db.from('board_posts')
      .select('id', { count: 'exact', head: true }).eq('name', name);
    if ((mine ?? 0) >= MAX_POSTS_EACH) return send({ ok: false, error: 'enough' }, 429);

    const path = `${crypto.randomUUID()}.${img.ext}`;
    const up = await db.storage.from('board').upload(path, img.bytes, {
      contentType: `image/${img.ext === 'jpg' ? 'jpeg' : img.ext}`, upsert: false,
    });
    if (up.error) return send({ ok: false, error: 'upload' }, 500);

    /* guest_id is looked up rather than trusted from the client, and stays null
       if the name doesn't match — a nickname typed at the door shouldn't fail
       the upload, it should just not claim to be somebody on the list */
    const { data: g } = await db.from('guests').select('id')
      .not('code', 'is', null).ilike('name', `${name}%`).limit(1).maybeSingle();

    const { data, error } = await db.from('board_posts')
      .insert({ name, tag, colour, path, guest_id: g?.id ?? null })
      .select('id').single();
    if (error) {
      await db.storage.from('board').remove([path]);   // don't orphan the file
      return send({ ok: false, error: 'save' }, 500);
    }
    return send({ ok: true, id: data.id, url: PUBLIC_BASE + path });
  }

  /* ------------------------------------------------------------------ vote */
  if (action === 'vote') {
    const voter = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    const postId = typeof b.post === 'string' ? b.post : '';
    if (!voter || !postId) return send({ ok: false, error: 'bad' }, 400);

    const { count: used } = await db.from('board_votes')
      .select('id', { count: 'exact', head: true }).eq('voter', voter);
    /* the unique index makes a second vote on the same post a no-op rather than
       an error, so re-tapping never costs anyone one of their three */
    const already = await db.from('board_votes')
      .select('id').eq('voter', voter).eq('post_id', postId).maybeSingle();
    if (already.data) return send({ ok: true, left: Math.max(0, VOTES_EACH - (used ?? 0)) });
    if ((used ?? 0) >= VOTES_EACH) return send({ ok: false, error: 'spent' }, 429);

    const { error } = await db.from('board_votes').insert({ voter, post_id: postId });
    if (error) return send({ ok: false, error: 'save' }, 500);
    return send({ ok: true, left: Math.max(0, VOTES_EACH - (used ?? 0) - 1) });
  }

  /* ----------------------------------------------------------------- board */
  const [posts, votes] = await Promise.all([
    db.from('board_posts').select('id,name,tag,colour,path,created_at')
      .eq('hidden', false).order('created_at', { ascending: false }).limit(300),
    db.from('board_votes').select('post_id,voter'),
  ]);
  const rows = posts.data || [];
  const v = votes.data || [];
  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.tag] = (tally[r.tag] || 0) + 1;

  const mine = typeof b.name === 'string' ? b.name.trim() : '';
  return send({
    ok: true,
    posts: rows.map((r) => ({
      id: r.id, name: String(r.name).split(/\s+/)[0], tag: r.tag, colour: r.colour,
      url: PUBLIC_BASE + r.path, at: r.created_at,
      votes: v.filter((x) => x.post_id === r.id).length,
    })),
    /* ranked here rather than on the wall: the order IS the result, and two
       screens sorting the same numbers their own way is how they disagree */
    tally: Object.entries(tally).sort((a, c) => c[1] - a[1]).map(([tag, n]) => ({ tag, n })),
    total: rows.length,
    people: new Set(rows.map((r) => r.name)).size,
    votesEach: VOTES_EACH,
    myVotes: mine ? v.filter((x) => x.voter === mine).map((x) => x.post_id) : [],
    myPosts: mine ? rows.filter((r) => r.name === mine).length : 0,
  });
});
