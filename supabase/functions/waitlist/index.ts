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
//  It also SENDS. /late ends on "check your inbox soon", and for a while that
//  was a promise nothing kept — the row landed and no mail ever went out. The
//  note is the same Y2K handset the applicants get (_shared/handset-email.ts),
//  with different words, because a latecomer who forwards it to an applicant
//  should see the same phone.
//
//  Deploy: supabase functions deploy waitlist
//  Secrets: shares submit's — RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO, MAIL_BCC
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handsetEmail, sendHandsetEmail } from '../_shared/handset-email.ts';

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

/* The same door the confirmation email opens on. /late promises "a little
   surprise in it for you" and this is it: the arcade is the one part of the
   night that costs nothing to hand a latecomer, and it is a real link — it
   drops the gate and opens the arcade directly, skipping the application flow
   they can no longer use. If latecomers should NOT get in, point this at
   https://secretslumberparty.com and change the third line below; nothing else
   in this file assumes the arcade. */
const ARCADE = 'https://secretslumberparty.com/?arcade';

/* No name is ever collected on /late — one field, one row — so the greeting is
   "hey you", not a first name guessed out of the local part of an address. */
function waitlistEmail() {
  return handsetEmail({
    // no emoji, same as the confirmation: free to drop on a young domain
    subject: 'noted — you got on the list after all',
    preview: '1 new message from khushi &#9829; you missed the door, not the night',
    greetingName: 'you',
    lines: [
      'you missed the applications &#8212; but not the rest of it.',
      /* Three lines, and each one is shorter than it wants to be. The phone only
         reads as a phone while the LCD stays around 45% of it — a fourth line,
         or these three at full length, and the handset quietly becomes a slab
         with a keypad glued underneath. */
      "i'm keeping this list for whatever comes next. you'll hear it here first. &#10024;",
      "and the surprise i promised: the arcade's open. &#129323;",
    ],
    cta: { label: '&#9658; OPEN ARCADE', href: ARCADE },
    footerReason: "you're getting this because you left your email at",
    text: `hey you,

you missed the applications — but not the rest of it.

i'm keeping this list for whatever comes next. you'll hear it here first.

and the surprise i promised: the arcade's open.

open the arcade: ${ARCADE}

—
you're getting this because you left your email at secretslumberparty.com.
reply to this email if that wasn't you.`,
  });
}

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
    /* 23505 = the unique index: they're already on the list, which is a happy path
       — and deliberately NOT a second email. Re-sending on every repeat submit
       would turn this endpoint into a way to mail a stranger five times an hour
       (that being the per-visitor cap) by typing their address into /late. The
       chat already answers this case with "you're already on my list". */
    if ((error as { code?: string }).code === '23505') {
      return new Response(JSON.stringify({ ok: true, already: true }), { headers: cors(origin) });
    }
    return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500, headers: cors(origin) });
  }

  /* Sent only once the row is safe, and a mail failure never fails the signup:
     the email address is the thing this page exists to collect. The reason goes
     to submit_log, which only admins can read — never to the response, because
     Resend names the sending domain and the account state in its rejections. */
  const { sent: emailed, reason } = await sendHandsetEmail(email, waitlistEmail());
  if (!emailed && reason && reason !== 'no RESEND_API_KEY') {
    await db.from('submit_log').insert({ kind: 'email_failed', ip_hash: 'n/a', note: 'waitlist: ' + reason });
  }

  return new Response(JSON.stringify({ ok: true, emailed }), { headers: cors(origin) });
});
