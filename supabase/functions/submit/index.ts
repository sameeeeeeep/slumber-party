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

const MAX_PER_IP_PER_HOUR = 5;

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
function confirmationEmail(name: string) {
  const first = name.split(/\s+/)[0] || 'you';
  return {
    // no emoji in the subject: it isn't decisive, but it's free to drop and
    // some filters still score it on a domain with no sending history
    subject: 'noted — khushi got your application',
    text: `hi ${first},

your application landed. i'm on my way to stalk you!!! i'll reach out if you're in :)

there are only a few spots left, so hold tight — till then, the arcade is open.

back to the party: https://secretslumberparty.com

—
you're getting this because you applied at secretslumberparty.com.
reply to this email if that wasn't you.`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;background:#fdeff3;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fffcfd;border-radius:18px;padding:28px 26px;
              border:1px solid rgba(235,100,140,.28)">
    <img src="https://secretslumberparty.com/assets/logo-email.png" alt="(secret;) khushi's slumber party"
         style="display:block;width:200px;max-width:70%;height:auto;margin:0 auto 22px" />
    <p style="font-size:17px;line-height:1.5;color:#5a4650;margin:0 0 14px">hi ${escapeHtml(first)},</p>
    <p style="font-size:17px;line-height:1.5;color:#5a4650;margin:0 0 14px">
      your application landed. i'm on my way to stalk you!!! i'll reach out if you're in :)
    </p>
    <p style="font-size:17px;line-height:1.5;color:#5a4650;margin:0 0 22px">
      there are only a few spots left, so hold tight — till then, the arcade is open.
    </p>
    <a href="https://secretslumberparty.com"
       style="display:inline-block;background:#eb648c;color:#fff;text-decoration:none;
              padding:13px 22px;border-radius:10px;font-size:15px;letter-spacing:.02em">
      back to the party ▸
    </a>
    <p style="font-size:13px;line-height:1.5;color:#9b8790;margin:24px 0 0">
      you're getting this because you applied at secretslumberparty.com. reply to this email if that wasn't you.
    </p>
  </div>
</div>`,
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
  async function logFailure(note: string) {
    try {
      await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'application_failed', note });
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
  const { count } = await db
    .from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).eq('kind', 'application').gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    await logFailure(`rate limited: ${count} in the last hour`);
    return json({ error: 'too many applications from here — try again in a bit' }, 429, origin);
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

  await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'application' });

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
      if (!res.ok) console.error('resend rejected', res.status, await res.text());
    } catch (e) {
      console.error('resend threw', e);
    }
  }

  return json({ ok: true, id: data.id, emailed }, 200, origin);
});
