// ============================================================================
//  POST /functions/v1/housemates — the introduction line.
//
//  Read live at the round table while the forty of them are introduced to each
//  other, so it returns everyone in a fixed, deliberate order and nothing else:
//  ordering that shifts between refreshes would derail the person presenting.
//
//  Behind its own word, separate from the guest word. This runs on a laptop or a
//  phone held by whoever is hosting, and it should not stop working — or start
//  working for a guest — because the guest word changed.
//
//  Same privacy boundary as /house: a hand-written column list, never `*`.
//
//  Deploy: supabase functions deploy housemates
//  Secret: supabase secrets set HOUSEMATES_HASH=<pbkdf2 hex>
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

/* Same discipline as every other word on this site: the plaintext exists nowhere,
   only a 100k-round derivation of it. */
async function pbkdf2Hex(word: string) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('ssp-housemates-pass'), iterations: 100000, hash: 'SHA-256' },
    base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

  const REAL_HASH = Deno.env.get('HOUSEMATES_HASH');
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
  const ipHash = await sha256('housemates:' + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_TRIES_PER_IP_PER_HOUR) {
    return new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429, headers: cors(origin) });
  }

  if (await pbkdf2Hex(given) !== REAL_HASH) {
    await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'housemates' });
    return new Response(JSON.stringify({ ok: false, error: 'wrong' }), { status: 401, headers: cors(origin) });
  }

  const { data, error } = await db.from('guests')
    .select('name,intro,blurb,avatar_url,instagram,sprite,tier,intro_pos')
    .not('code', 'is', null)
    .order('name');
  if (error) {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: cors(origin) });
  }

  /* One fixed order: anyone given an explicit position leads, in that order, then
     everyone else alphabetically. Stable across refreshes, which matters when a
     room of forty people is being walked through one at a time. */
  const rows = (data || []).slice().sort((a, b) => {
    const pa = a.intro_pos ?? 9999, pb = b.intro_pos ?? 9999;
    return pa - pb || String(a.name).localeCompare(String(b.name));
  });

  const people = rows.map((g) => {
    const name = String(g.name || '').trim();
    const first = name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || 'guest';
    const ig = String(g.instagram || '').trim().replace(/^@+/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
    return {
      name, first,
      // `intro` is written for this moment; `blurb` is the house one-liner, used
      // as a fallback so nobody is introduced as a blank card
      intro: g.intro ? String(g.intro).slice(0, 600) : (g.blurb ? String(g.blurb).slice(0, 600) : null),
      art: g.avatar_url || null,
      instagram: ig || null,
      sprite: Number.isInteger(g.sprite) ? g.sprite : spriteFor(name),
      tier: g.tier || 'bestie',
    };
  });

  return new Response(JSON.stringify({ ok: true, people }), { headers: cors(origin) });
});
