// ============================================================================
//  POST /functions/v1/submit — the ONLY way an application reaches the database.
//
//  Why a function instead of letting the browser insert straight into the table:
//    · the anon key is public, so a table-level insert policy would let anyone
//      write anything. Here the anon key only buys you the right to call this,
//      and the function decides what actually gets stored.
//    · it validates server-side, where the rules can't be edited in devtools.
//    · it rate-limits by IP.
//    · it returns a REAL success/failure, so the site can stop telling people
//      "noted…" for submissions that never landed (the old no-cors Google Form
//      post could not tell the difference).
//    · the confirmation email goes out here, in the same breath as the insert.
//
//  Deploy:  supabase functions deploy submit
//  Secrets: supabase secrets set RESEND_API_KEY=... IP_SALT=... \
//                                MAIL_FROM="khushi <khushi@send.secretslumberparty.com>" \
//                                MAIL_REPLY_TO="hello@secretslumberparty.com" \
//                                MAIL_BCC="you@yourdomain.com"
//
//  MAIL DELIVERABILITY LIVES IN DNS, NOT HERE. Nothing in this file will keep a
//  message out of spam if the sending domain can't authenticate. As of writing,
//  secretslumberparty.com has DKIM (google + resend) and DMARC p=quarantine but
//  NO SPF RECORD AT ALL — which means "quarantine anything that doesn't prove
//  itself" with one of the two proofs missing. The root domain needs:
//      TXT  @  v=spf1 include:_spf.google.com ~all
//  and Google Workspace DKIM has to be switched ON in the admin console, not
//  merely present in DNS. send.secretslumberparty.com is already correct.
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handsetEmail, sendHandsetEmail } from '../_shared/handset-email.ts';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

/* THROTTLING, AND WHY THE IP NUMBER IS SO HIGH
   ------------------------------------------------------------------
   This was 5 per IP per hour, which would have blocked real applicants the moment
   Khushi posted. Indian mobile carriers put thousands of subscribers behind a
   handful of NAT addresses, so on Jio or Airtel — or one college's wifi — the
   sixth applicant in an hour is a different person on a different phone and would
   have been told "too many applications from here".

   So the IP ceiling is now only a flood stop: high enough that no plausible crowd
   of genuine applicants can reach it, low enough to blunt a script.

   The precise limit is the per-VISITOR one. Every browser already carries a
   persistent `visitor_id` (localStorage, set on first visit) which the Google Form
   post has always included; it's now sent here too. That's per-person rather than
   per-network, so it can't be defeated by NAT and can't punish a crowd.

   Neither number is the real duplicate guard: the unique index on email is. These
   only exist to keep a runaway script from filling the table. */
/* Carrier NAT can put hundreds of real phones behind one IP in India. In a
   launch-day spike the per-IP cap is the number of REAL applicants an IP may
   carry per hour, not a spam dial — abuse is already held by the per-visitor
   cap below. 120 was survivable; thousands applying makes it a ceiling. */
const MAX_PER_IP_PER_HOUR = 500;
const MAX_PER_VISITOR_PER_HOUR = 6;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });

/** Salted SHA-256 of the caller's IP. Used only to count recent submissions —
 *  it is never stored next to an application, so it can't re-identify anyone. */
async function hashIp(ip: string) {
  const salt = Deno.env.get('IP_SALT') ?? 'change-me';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

/** Mirrors the validation the chat does, because client-side rules are advisory. */
function validate(b: Record<string, unknown>) {
  const name = str(b.name, 120);
  if (!name) return { error: 'name is required' };

  const email = str(b.email, 200)?.toLowerCase() ?? null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'a valid email is required' };

  const ageRaw = typeof b.age === 'number' ? b.age : parseInt(String(b.age ?? ''), 10);
  const age = Number.isFinite(ageRaw) ? ageRaw : null;
  if (age === null || age < 18 || age > 99) return { error: 'age must be between 18 and 99' };

  let phone = str(b.phone, 30);
  if (phone) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    phone = digits.length === 10 ? `+91 ${digits}` : null;
  }

  let handle = str(b.handle, 60);
  if (handle) handle = '@' + handle.replace(/^@+/, '').replace(/\s+/g, '');

  return {
    row: {
      name,
      email,
      age,
      phone,
      handle,
      city: str(b.city, 80),
      role: str(b.role, 60),
      why: str(b.why, 2000),
      tz: str(b.tz, 60),
      referrer: str(b.referrer, 300),
      user_agent: str(b.user_agent, 300),
      // where they came from, classified in the browser — see trafficSource()
      source: str(b.source, 40),
    },
  };
}

/* The confirmation email — the handset it arrives on, the logo, and the whole
   deliverability posture live in _shared/handset-email.ts, because the note the
   waitlist gets on /late is the same phone with different words. Only the words
   are here. */

/* ?arcade is a real door, not the homepage: it drops the gate, unlocks audio
   and opens the arcade directly, skipping the intro and the application flow.
   Same link the besties invite uses. If a link-tracking wrapper ever strips
   the query, this silently lands on the intro instead — which is not what the
   key promises — so leave click tracking OFF for this send. */
const ARCADE = 'https://secretslumberparty.com/?arcade';

function confirmationEmail(name: string) {
  const first = name.split(/\s+/)[0] || 'you';
  return handsetEmail({
    // no emoji in the subject: it isn't decisive, but it's free to drop and
    // some filters still score it on a domain with no sending history
    subject: 'noted — khushi got your application',
    preview: "1 new message from khushi &#9829; your application's tucked in safe",
    greetingName: first,
    lines: [
      "your application's in &#8212; tucked in safe.",
      "i'm gathering thirty to spill the tea. if you're one of them, i'll whisper back. &#10024;",
    ],
    cta: { label: '&#9658; OPEN ARCADE', href: ARCADE },
    footerReason: "you're getting this because you applied at",
    text: `hey ${first},

your application's in — tucked in safe.

i'm gathering thirty to spill the tea. if you're one of them, i'll whisper back.

open the arcade: ${ARCADE}

—
you're getting this because you applied at secretslumberparty.com.
reply to this email if that wasn't you.`,
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,   // server-side only; never shipped to the browser
    { auth: { persistSession: false } },
  );

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await hashIp(ip);

  /* Record a submission that did NOT land.
     A rejected application leaves no row in `applications` — by definition — so
     without this the failure is invisible: the applicant sees the Google Sheet
     succeed, and the dashboard simply never mentions them. That is exactly how an
     application went missing on 7 Aug with nothing to point at.
     Never let the logging itself break the response. */
  // set once the body has been read; the failure log records it when known
  let vidHash: string | null = null;

  async function logFailure(note: string) {
    try {
      await db.from('submit_log')
        .insert({ ip_hash: ipHash, vid: vidHash, kind: 'application_failed', note });
    } catch (e) { console.error('could not log the failure', e); }
  }

  // ---- validate -----------------------------------------------------------
  const check = validate(body);
  if ('error' in check) {
    // which field, and what was wrong with it — but never the value itself
    const keys = Object.keys(body || {}).join(',');
    await logFailure(`rejected: ${check.error} · fields sent: ${keys}`);
    console.error('validation rejected', check.error, keys);
    return json({ error: check.error }, 400, origin);
  }
  const row = check.row!;

  // ---- throttle -----------------------------------------------------------
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  /* Hashed like the IP, and for the same reason: stored only to count, never to
     identify. A raw visitor_id next to an application would be a durable handle
     on a person across visits, which is more than throttling needs. */
  const vidRaw = str(body.visitor_id, 80);
  vidHash = vidRaw ? await hashIp(`vid:${vidRaw}`) : null;

  const recent = async (col: 'ip_hash' | 'vid', val: string) => {
    const { count } = await db.from('submit_log')
      .select('id', { count: 'exact', head: true })
      .eq(col, val).eq('kind', 'application').gte('created_at', hourAgo);
    return count ?? 0;
  };

  // per person first: it's the limit that should actually bite
  if (vidHash) {
    const mine = await recent('vid', vidHash);
    if (mine >= MAX_PER_VISITOR_PER_HOUR) {
      await logFailure(`rate limited (visitor): ${mine} in the last hour`);
      return json({ error: "you've already sent that a few times — give it an hour?" }, 429, origin);
    }
  }

  // then the flood stop, which a genuine crowd should never reach
  const fromHere = await recent('ip_hash', ipHash);
  if (fromHere >= MAX_PER_IP_PER_HOUR) {
    await logFailure(`rate limited (network): ${fromHere} in the last hour`);
    return json({ error: 'too many applications from this network — try again in a bit' }, 429, origin);
  }

  // ---- store --------------------------------------------------------------
  const { data, error } = await db.from('applications').insert(row).select('id').single();

  if (error) {
    // 23505 = the unique index on email. Treat a repeat as success: she already
    // applied, and telling her so is friendlier than an error in a chat bubble.
    if ((error as { code?: string }).code === '23505') {
      return json({ ok: true, duplicate: true }, 200, origin);
    }
    console.error('insert failed', error);
    await logFailure(`insert failed: ${(error as { code?: string }).code || ''} ${error.message || ''}`.trim());
    return json({ error: "couldn't save that — try again?" }, 500, origin);
  }

  await db.from('submit_log').insert({ ip_hash: ipHash, vid: vidHash, kind: 'application' });

  // ---- confirmation email -------------------------------------------------
  // Sent after the row is safe. A mail failure must NOT fail the submission:
  // the application is already stored, which is the part that matters.
  const { sent: emailed, reason } = await sendHandsetEmail(row.email!, confirmationEmail(row.name!));
  /* A rejection used to go to console.error only, which is invisible without log
     access — so "emailed: false" was a dead end. It lands in submit_log too,
     which only admins can read, so the reason survives long enough to fix.
     Never in the response: Resend's message names the sending domain and the
     account state, and the person filling in a form doesn't need either. */
  if (!emailed && reason && reason !== 'no RESEND_API_KEY') {
    await db.from('submit_log').insert({ kind: 'email_failed', ip_hash: 'n/a', note: reason });
  }

  return json({ ok: true, id: data.id, emailed }, 200, origin);
});
