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

/* ----------------------------------------------------------------------------
   DELIVERABILITY — why this email is shaped the way it is.

   Spam filtering is decided mostly at the DNS layer (SPF/DKIM/DMARC on the
   sending domain), not here. But three things in the message itself move the
   needle, and all three are cheap:

     · a plain-text alternative. An HTML-only message is one of the oldest
       bulk-mail tells there is, because real mail clients send multipart.
     · List-Unsubscribe. Gmail and Outlook both weigh it, and a one-click
       unsubscribe is treated as far friendlier than a "report spam" click —
       which is the thing that actually poisons a domain's reputation.
     · a From address on a domain that is actually authenticated. See MAIL_FROM
       below: send from the domain Resend verified, not a cousin of it.
   -------------------------------------------------------------------------- */
/* ============================================================================
   THE CONFIRMATION EMAIL — Y2K, and built to reach an inbox.

   Those two goals pull against each other, so every decision here is the one
   that keeps both:

   · TABLES AND INLINE CSS. Outlook still renders with Word's engine, which
     ignores flexbox, grid, and most of a <style> block. Tables are ugly to write
     and they are what actually arrives looking like the thing you designed.

   · THE LOOK IS BUILT, NOT EXPORTED. The single most common way a beautiful
     email lands in spam is being one big exported image with four words of text.
     Filters read text and an image is opaque to them, so the window chrome, the
     dividers and the button are all HTML. One 9KB logo is the only image.

   · IT READS WITH IMAGES OFF. Gmail and Outlook hide images from unknown senders
     by default, which is every recipient here. Alt text does the work, and the
     first thing under the logo is words.

   · EVERY COLOUR IS EXPLICIT, including on the outer table. Dark-mode clients
     invert what they can't see declared, and a Y2K palette inverts badly.

   · A PLAIN-TEXT TWIN, always. An HTML-only email is a spam signal by itself.
   ========================================================================== */
function confirmationEmail(name: string) {
  const first = escapeHtml(name.split(/\s+/)[0] || 'you');
  const PINK = '#eb648c', WINE = '#5a4650', SOFT = '#9b8790';
  const MONO = "'Courier New', Courier, monospace";   // the only monospace on every client

  /* the little window chrome, the bit that does most of the Y2K work */
  const bar = `
      <tr>
        <td bgcolor="${PINK}" style="padding:9px 12px;font-family:${MONO};font-size:12px;
            letter-spacing:.14em;color:#ffffff;text-transform:uppercase">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-family:${MONO};font-size:12px;color:#ffffff;letter-spacing:.14em">
                &#9670; secret slumber party
              </td>
              <td align="right" style="font-family:${MONO};font-size:12px;color:#ffffff">
                &#9633; &#9635; &#10005;
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const rule = `
      <tr><td style="padding:0 26px">
        <div style="border-top:2px dashed #f3d3dd;font-size:0;line-height:0">&nbsp;</div>
      </td></tr>`;

  return {
    // no emoji in the subject: it isn't decisive, but it's free to drop and
    // some filters still score it on a domain with no sending history
    subject: 'noted — khushi got your application',
    text: `hi ${name.split(/\s+/)[0] || 'you'},

your application landed. i'm on my way to stalk you!!! i'll reach out if you're in :)

there are only a few spots left, so hold tight — till then, the arcade is open.

back to the party: https://secretslumberparty.com

—
you're getting this because you applied at secretslumberparty.com.
reply to this email if that wasn't you.`,
    html: `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>noted</title>
</head>
<body style="margin:0;padding:0;background-color:#fdeff3">
<!-- preview text: what shows in the inbox list next to the subject, and the one
     place to say something other than "hi" -->
<div style="display:none;font-size:1px;color:#fdeff3;line-height:1px;max-height:0;
     max-width:0;opacity:0;overflow:hidden">
  you're on the list to be looked at. the arcade is open while you wait.
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="#fdeff3" style="background-color:#fdeff3">
  <tr><td align="center" style="padding:28px 14px">

    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
           style="width:480px;max-width:100%;background-color:#fffcfd;border:2px solid ${PINK};
                  border-radius:14px;overflow:hidden">
      ${bar}

      <tr><td align="center" style="padding:26px 26px 6px">
        <img src="https://secretslumberparty.com/assets/logo-email.png"
             alt="khushi's secret slumber party" width="200"
             style="display:block;width:200px;max-width:70%;height:auto;border:0;outline:none" />
      </td></tr>

      <tr><td style="padding:14px 26px 0;font-family:${MONO};font-size:12px;
          letter-spacing:.18em;color:${PINK};text-transform:uppercase">
        &#9733; application received &#9733;
      </td></tr>

      <tr><td style="padding:10px 26px 0;font-family:Helvetica,Arial,sans-serif;
          font-size:17px;line-height:1.55;color:${WINE}">
        <p style="margin:0 0 14px">hi ${first},</p>
        <p style="margin:0 0 14px">your application landed. i'm on my way to stalk you!!!
          i'll reach out if you're in :)</p>
        <p style="margin:0 0 20px">there are only a few spots left, so hold tight —
          till then, the arcade is open.</p>
      </td></tr>

      <!-- a bulletproof button: a table, not a styled <a>, because Outlook drops
           padding on inline-block links and the button collapses to text -->
      <tr><td style="padding:0 26px 24px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="${PINK}" style="border-radius:10px">
            <a href="https://secretslumberparty.com"
               style="display:inline-block;padding:13px 24px;font-family:${MONO};
                      font-size:13px;letter-spacing:.1em;color:#ffffff;text-decoration:none;
                      text-transform:uppercase">back to the party &#9656;</a>
          </td></tr>
        </table>
      </td></tr>
      ${rule}

      <tr><td style="padding:16px 26px 26px;font-family:Helvetica,Arial,sans-serif;
          font-size:13px;line-height:1.55;color:${SOFT}">
        you're getting this because you applied at secretslumberparty.com.
        reply to this email if that wasn't you.
      </td></tr>
    </table>

    <div style="font-family:${MONO};font-size:11px;color:${SOFT};padding:14px 0 0;
         letter-spacing:.12em">&#9671; &#9671; &#9671;</div>

  </td></tr>
</table>
</body></html>`,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const key = Deno.env.get('RESEND_API_KEY');
  let emailed = false;
  if (key) {
    try {
      const mail = confirmationEmail(row.name!);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /* Send from the domain Resend actually verified. DKIM here signs as
             send.secretslumberparty.com; a From on the bare root only passes
             DMARC because alignment is relaxed, which is a thin thread to hang
             deliverability on. Override with MAIL_FROM once the root domain is
             verified in Resend too. */
          from: Deno.env.get('MAIL_FROM') ?? 'khushi <khushi@send.secretslumberparty.com>',
          to: [row.email],
          bcc: Deno.env.get('MAIL_BCC') ? [Deno.env.get('MAIL_BCC')] : undefined,
          // replies should reach a real inbox, not the sending subdomain
          reply_to: Deno.env.get('MAIL_REPLY_TO') ?? 'hello@secretslumberparty.com',
          subject: mail.subject,
          html: mail.html,
          text: mail.text,          // multipart, not HTML-only
          headers: {
            /* One-click unsubscribe. A person who taps this costs nothing; the
               same person hitting "report spam" costs the domain far more. */
            'List-Unsubscribe': `<mailto:${
              Deno.env.get('MAIL_REPLY_TO') ?? 'hello@secretslumberparty.com'
            }?subject=unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });
      emailed = res.ok;
      /* A rejection used to go to console.error, which is invisible without log
         access — so "emailed: false" was a dead end. It lands in submit_log now,
         which only admins can read, so the reason survives long enough to fix.
         Never in the response: Resend's message names the sending domain and the
         account state, and the person filling in a form doesn't need either. */
      if (!res.ok) {
        const why = (await res.text()).slice(0, 400);
        console.error('resend rejected', res.status, why);
        await db.from('submit_log').insert({
          kind: 'email_failed', ip_hash: 'n/a', note: `${res.status} ${why}`,
        });
      }
    } catch (e) {
      console.error('resend threw', e);
      await db.from('submit_log').insert({
        kind: 'email_failed', ip_hash: 'n/a', note: 'threw: ' + String(e).slice(0, 300),
      });
    }
  }

  return json({ ok: true, id: data.id, emailed }, 200, origin);
});
