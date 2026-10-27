// ============================================================================
//  POST /functions/v1/prebuzz — everything the prebuzz chat on / talks to.
//
//  One function, a handful of actions, picked by body.action:
//
//    check   {phone}            → is this a slumber applicant? if so, a session
//                                 token + the secret chat. If not, {member:false}
//                                 and the browser carries on as a stranger.
//    me      {token}            → the secret chat again, for a returning member
//    photo   {token, idx}       → a signed URL for photo 0, 1 or 2 — each ONCE per phone
//    hamper  {token, url}       → enter the hamper draw with a post link
//    email   {token, email}     → the address the early-access promo should go to
//    lead    {phone, email, …}  → a stranger's details
//    verify  {code, phone}      ┐ for the CHECKOUT, not the browser: both need
//    redeem  {code, phone, ref} ┘ the x-prebuzz-key header (PREBUZZ_REDEEM_KEY)
//
//  WHY NOTHING SECRET IS IN HERE. This file is in a public repo. The coupon
//  code, the discount and her lines live in public.prebuzz_settings (see the
//  migration), and leave the database only inside a `check`/`me` reply to a
//  phone that matched `applications`. The reply never includes the applicant's
//  name or email either: someone guessing numbers learns "this number applied"
//  and nothing about who it belongs to.
//
//  Deploy:  supabase functions deploy prebuzz
//  Secrets: supabase secrets set PREBUZZ_REDEEM_KEY=<long random string>
//           (IP_SALT is shared with submit)
// ============================================================================
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://access.nailin.it',              // the prebuzz page (Pages project nailinit-access)
  'https://nailinit-access.pages.dev',
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

/* Phone checks are the one thing worth scripting against — a loop over numbers
   would map who applied. Per-visitor is the cap a human never meets; per-IP is
   generous for the same carrier-NAT reason submit's is. */
const MAX_CHECKS_PER_VISITOR_PER_HOUR = 8;
const MAX_CHECKS_PER_IP_PER_HOUR = 300;
const MAX_LEADS_PER_IP_PER_HOUR = 300;
/* The per-visitor and per-IP caps both rest on values the caller can change
   (visitor_id is theirs; x-forwarded-for can be prefixed). This one can't be
   dodged: every number that DOESN'T match counts towards one site-wide ceiling,
   so a script walking numbers runs dry within the hour. Real visitors mostly
   either match or move on to the signup, so they barely touch it. */
const MAX_CHECK_MISSES_PER_HOUR = 1500;

const SESSION_DAYS = 14;
/* The chat shows each photo for 30 seconds; the URL outlives that only by the
   time it takes to load. */
const PHOTO_URL_SECONDS = 45;
const MAX_PHOTOS = 3;
/* View-once, with a little mercy: if a photo fails to load the first time,
   asking again within this window still works. After it, it's gone. */
const PHOTO_GRACE_SECONDS = 120;
const BUCKET = 'prebuzz-photos';

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-prebuzz-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function sha(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
const hashIp = (ip: string) => sha(`${Deno.env.get('IP_SALT') ?? 'change-me'}:${ip}`);

/** Same shape submit stores: '+91 ' and the last ten digits. */
function normPhone(v: unknown) {
  const digits = String(v ?? '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? `+91 ${digits}` : null;
}

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time compare, so the checkout key can't be guessed byte by byte. */
function sameKey(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type Db = SupabaseClient;

/** The applicant this phone belongs to: its application id, or 'demo' for a
 *  number listed in prebuzz_settings.demo_phones (so the flow can be shown
 *  without inventing a row in `applications`). */
async function applicantId(db: Db, phone: string) {
  const { data } = await db.from('applications').select('id').eq('phone', phone).limit(1);
  if (data?.[0]?.id) return data[0].id as string;
  const demo = (await settings(db)).demo_phones;
  if (Array.isArray(demo) && demo.map(d => normPhone(d)).includes(phone)) return 'demo';
  return undefined;
}
const appRef = (id: string) => (id === 'demo' ? null : id);

async function settings(db: Db) {
  const { data } = await db.from('prebuzz_settings').select('value').eq('key', 'secret').single();
  return (data?.value ?? {}) as Record<string, unknown>;
}

/** Everything the secret chat shows. Built here so the browser holds none of it
 *  until a phone has matched. */
async function photoNames(db: Db) {
  const { data } = await db.storage.from(BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });
  // folders come back with a null id; only real files count
  return (data ?? []).filter(f => f.id).map(f => f.name).slice(0, MAX_PHOTOS);
}

/** "khushi@gmail.com" → "kh•••@gmail.com". The phone alone opens the group, so
 *  the chat only ever sees enough of the address to recognise it, never all of it. */
function maskEmail(e: string | null | undefined) {
  if (!e || !e.includes('@')) return null;
  const [user, domain] = e.split('@');
  return user.slice(0, Math.min(2, user.length)) + '•••@' + domain;
}

async function secretChat(db: Db, phone: string) {
  const [s, m, names] = await Promise.all([
    settings(db),
    db.from('prebuzz_members')
      .select('photos_viewed, coupon_redeemed_at, hamper_status, email, email_confirmed_at, applications(email)')
      .eq('phone', phone).single(),
    photoNames(db),
  ]);
  const row: { photos_viewed?: Record<string, string>; coupon_redeemed_at?: string | null; hamper_status?: string;
    email?: string | null; email_confirmed_at?: string | null; applications?: unknown } = m.data ?? {};
  // the joined application comes back as an object (many-to-one); typed loosely, so read either shape
  const app = (Array.isArray(row.applications) ? row.applications[0] : row.applications) as { email?: string | null } | null | undefined;
  // the promo goes to the address they confirmed here, else the one they applied with
  const promoEmail = row.email ?? app?.email ?? null;
  const viewed = row.photos_viewed ?? {};
  return {
    lines: Array.isArray(s.lines) ? s.lines : [],
    photo_lines: Array.isArray(s.photo_lines) ? s.photo_lines : [],
    // only whether each was opened — never the file names
    photos: names.map((_, i) => ({ viewed: i in viewed })),
    after_lines: Array.isArray(s.after_lines) ? s.after_lines : [],
    coupon_line: s.coupon_line ?? null,
    coupon: s.coupon ?? null,
    discount: s.discount ?? null,
    coupon_used: !!row.coupon_redeemed_at,
    hamper_line: s.hamper_line ?? null,
    hamper_tag: s.hamper_tag ?? null,
    hamper: row.hamper_status ?? 'none',
    email_masked: maskEmail(promoEmail),
    email_confirmed: !!row.email_confirmed_at,
  };
}

async function phoneForToken(db: Db, token: unknown) {
  const t = str(token, 100);
  if (!t) return null;
  const { data } = await db.from('prebuzz_sessions')
    .select('phone, expires_at').eq('token_hash', await sha(`pb:${t}`)).single();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.phone as string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await hashIp(ip);
  const vidRaw = str(b.visitor_id, 80);
  const vidHash = vidRaw ? await hashIp(`vid:${vidRaw}`) : null;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const recent = async (kind: string, col: 'ip_hash' | 'vid', val: string) => {
    const { count } = await db.from('submit_log')
      .select('id', { count: 'exact', head: true })
      .eq(col, val).eq('kind', kind).gte('created_at', hourAgo);
    return count ?? 0;
  };
  const log = (kind: string) =>
    db.from('submit_log').insert({ ip_hash: ipHash, vid: vidHash, kind }).then(() => {}, () => {});

  const action = str(b.action, 20);

  // ---------------------------------------------------------------- check
  if (action === 'check') {
    if (!vidHash) return json({ error: 'rate' }, 429, origin);
    const { count: misses } = await db.from('submit_log')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'prebuzz_miss').gte('created_at', hourAgo);
    if ((misses ?? 0) >= MAX_CHECK_MISSES_PER_HOUR) return json({ error: 'rate' }, 429, origin);
    if (vidHash && await recent('prebuzz_check', 'vid', vidHash) >= MAX_CHECKS_PER_VISITOR_PER_HOUR)
      return json({ error: 'rate' }, 429, origin);
    if (await recent('prebuzz_check', 'ip_hash', ipHash) >= MAX_CHECKS_PER_IP_PER_HOUR)
      return json({ error: 'rate' }, 429, origin);
    await log('prebuzz_check');

    const phone = normPhone(b.phone);
    if (!phone) return json({ error: 'phone' }, 400, origin);

    const appId = await applicantId(db, phone);
    if (!appId) { await log('prebuzz_miss'); return json({ ok: true, member: false }, 200, origin); }

    const now = new Date().toISOString();
    const { error: upErr } = await db.from('prebuzz_members').upsert(
      { phone, application_id: appRef(appId), last_seen_at: now },
      { onConflict: 'phone' },
    );
    if (upErr) { console.error('member upsert', upErr); return json({ error: 'server' }, 500, origin); }

    const token = newToken();
    await db.from('prebuzz_sessions').insert({
      token_hash: await sha(`pb:${token}`), phone,
      expires_at: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
    });
    return json({ ok: true, member: true, token, chat: await secretChat(db, phone) }, 200, origin);
  }

  // ------------------------------------------------------------------- me
  if (action === 'me') {
    const phone = await phoneForToken(db, b.token);
    if (!phone) return json({ error: 'session' }, 401, origin);
    await db.from('prebuzz_members').update({ last_seen_at: new Date().toISOString() }).eq('phone', phone);
    return json({ ok: true, chat: await secretChat(db, phone) }, 200, origin);
  }

  // ---------------------------------------------------------------- photo
  if (action === 'photo') {
    const phone = await phoneForToken(db, b.token);
    if (!phone) return json({ error: 'session' }, 401, origin);
    const idx = typeof b.idx === 'number' ? b.idx : -1;
    const names = await photoNames(db);
    if (!Number.isInteger(idx) || idx < 0 || idx >= names.length) return json({ error: 'photo' }, 400, origin);

    // recorded and checked in one statement, so two tabs can't both get a first look
    const { data: allowed, error: claimErr } = await db.rpc('prebuzz_claim_photo',
      { p_phone: phone, p_idx: idx, p_grace_seconds: PHOTO_GRACE_SECONDS });
    if (claimErr) { console.error('claim', claimErr); return json({ error: 'server' }, 500, origin); }
    if (!allowed) return json({ ok: true, seen: true }, 200, origin);

    const { data: signed, error } = await db.storage.from(BUCKET).createSignedUrl(names[idx], PHOTO_URL_SECONDS);
    if (error || !signed) { console.error('sign', error); return json({ error: 'server' }, 500, origin); }
    return json({ ok: true, url: signed.signedUrl }, 200, origin);
  }

  // --------------------------------------------------------------- hamper
  if (action === 'hamper') {
    const phone = await phoneForToken(db, b.token);
    if (!phone) return json({ error: 'session' }, 401, origin);
    const url = str(b.url, 400);
    let host = '', href = '';
    try {
      const u = new URL(url ?? '');
      // only http(s): a javascript: link would run in /admin when someone clicks it
      if (u.protocol === 'https:' || u.protocol === 'http:') { host = u.hostname.replace(/^www\./, ''); href = u.href; }
    } catch { /* not a url */ }
    if (!/^(instagram\.com|instagr\.am|threads\.net|threads\.com|x\.com|twitter\.com|tiktok\.com|vm\.tiktok\.com|youtube\.com|youtu\.be|facebook\.com|snapchat\.com)$/.test(host))
      return json({ error: 'url' }, 400, origin);
    // one entry per phone; a later link replaces an earlier one until a winner is picked
    const { error } = await db.from('prebuzz_members')
      .update({ hamper_post_url: href, hamper_submitted_at: new Date().toISOString(), hamper_status: 'entered' })
      .eq('phone', phone).in('hamper_status', ['none', 'entered']);
    if (error) { console.error('hamper', error); return json({ error: 'server' }, 500, origin); }
    return json({ ok: true }, 200, origin);
  }

  // ---------------------------------------------------------------- email
  /* Where the early-access promo goes. `email` absent = "yes, that's still me"
     (confirms the address on file); present = a new one. Stored on the member
     row — the application itself is never edited. */
  if (action === 'email') {
    const phone = await phoneForToken(db, b.token);
    if (!phone) return json({ error: 'session' }, 401, origin);
    const email = str(b.email, 200)?.toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'email' }, 400, origin);
    const patch: Record<string, string> = { email_confirmed_at: new Date().toISOString() };
    if (email) patch.email = email;
    /* Once only. The phone alone opened this chat, so whoever answers first sets
       it and nobody can redirect it afterwards. A changed address never replaces
       the application's own email — the promo should go to BOTH (see migration). */
    const { data: set, error } = await db.from('prebuzz_members').update(patch)
      .eq('phone', phone).is('email_confirmed_at', null).select('phone');
    if (error) { console.error('email', error); return json({ error: 'server' }, 500, origin); }
    if (!set?.length) return json({ ok: false, error: 'locked' }, 409, origin);
    return json({ ok: true, email_masked: email ? maskEmail(email) : undefined }, 200, origin);
  }

  // ----------------------------------------------------------------- lead
  if (action === 'lead') {
    if (await recent('prebuzz_lead', 'ip_hash', ipHash) >= MAX_LEADS_PER_IP_PER_HOUR)
      return json({ error: 'rate' }, 429, origin);
    const name = str(b.name, 120);
    const phone = normPhone(b.phone);
    const email = str(b.email, 200)?.toLowerCase() || null;
    if (!phone) return json({ error: 'phone' }, 400, origin);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'email' }, 400, origin);
    let handle = str(b.handle, 60);
    if (handle) handle = '@' + handle.replace(/^@+/, '').replace(/\s+/g, '');
    await log('prebuzz_lead');

    const { error } = await db.from('prebuzz_leads').insert({
      name, phone, email, handle: handle || null,
      city: str(b.city, 80), guess: str(b.guess, 500),
      source: str(b.source, 40), tz: str(b.tz, 60), user_agent: str(b.user_agent, 300),
    });
    if (error) {
      // same reply as a fresh signup, so this can't be used to test whether a number signed up
      if ((error as { code?: string }).code === '23505') return json({ ok: true }, 200, origin);
      console.error('lead insert', error);
      return json({ error: 'server' }, 500, origin);
    }
    return json({ ok: true }, 200, origin);
  }

  // ------------------------------------------------------ verify / redeem
  /* The checkout's side of "one code, bound to phones". Server-to-server only:
     without PREBUZZ_REDEEM_KEY these refuse, so the browser can't use them to
     test numbers. `verify` is for showing the discount in the cart; `redeem`
     is called once the order is paid and burns the code for that phone. */
  if (action === 'verify' || action === 'redeem') {
    const key = Deno.env.get('PREBUZZ_REDEEM_KEY') ?? '';
    if (!sameKey(req.headers.get('x-prebuzz-key') ?? '', key)) return json({ error: 'forbidden' }, 403, origin);

    const phone = normPhone(b.phone);
    const code = str(b.code, 60)?.toUpperCase();
    const s = await settings(db);
    if (!phone || !code || code !== String(s.coupon ?? '').toUpperCase())
      return json({ ok: false, reason: 'invalid_code' }, 200, origin);

    const appId = await applicantId(db, phone);
    if (!appId) return json({ ok: false, reason: 'not_registered' }, 200, origin);

    // an applicant who never opened the chat can still use the code
    await db.from('prebuzz_members').upsert({ phone, application_id: appRef(appId) }, { onConflict: 'phone', ignoreDuplicates: true });

    if (action === 'verify') {
      const { data } = await db.from('prebuzz_members').select('coupon_redeemed_at').eq('phone', phone).single();
      return data?.coupon_redeemed_at
        ? json({ ok: false, reason: 'already_used' }, 200, origin)
        : json({ ok: true, discount: s.discount ?? null }, 200, origin);
    }

    const { data: burned } = await db.from('prebuzz_members')
      .update({ coupon_redeemed_at: new Date().toISOString(), coupon_order_ref: str(b.ref, 120) })
      .eq('phone', phone).is('coupon_redeemed_at', null).select('phone');
    return burned?.length
      ? json({ ok: true, discount: s.discount ?? null }, 200, origin)
      : json({ ok: false, reason: 'already_used' }, 200, origin);
  }

  return json({ error: 'unknown action' }, 400, origin);
});
