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
/* The event wordmark, embedded in the message as an inline (cid:) attachment
   rather than hotlinked. Gmail and Outlook hide remote images from unknown
   senders by default — which is every recipient here — so a hosted <img> is a
   blank space on first open. Base64 of assets/logo-email.png (9KB), which is
   the sticker cut of the wordmark and already carries its cream outline. */
const LOGO_B64 = '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';
const LOGO_CID = 'slumberlogo';

/* ===========================================================================
   THE CONFIRMATION EMAIL — a Y2K candybar handset, and the confirmation
   arrives on it as an SMS.

   WHY IT LOOKS LIKE THIS
     · PROPORTION. A 2002 phone is mostly keypad. Screen ~45%, keypad ~40%.
       Give the screen the bulk and you have drawn an iPhone.
     · The LCD is small and sits inside a large BLACK FASCIA PANEL, the way real
       handsets did. Running the LCD edge-to-edge in a thin bezel is the single
       most "not a real phone" thing this can do.
     · Keys carry a hard light-to-dark break at their midpoint — that is how
       moulded plastic catches light. A soft fade reads as a web button.

   THE RULES THIS FILE STILL OBEYS
     · TABLES AND INLINE STYLES ONLY. <style> blocks are stripped by Gmail.
     · IT READS WITH IMAGES OFF — the logo is the only image, it is inline, and
       everything under it is text.
     · EVERY COLOUR IS EXPLICIT, including on the outer table, or dark-mode
       clients invert what they cannot see declared.
     · A PLAIN-TEXT TWIN, always. HTML-only is a spam signal by itself.
     · 8px of side padding, not 12: the handset is 300px and cannot shrink below
       its own min-content width, so 12px overflowed a 320px screen by 4px.
     · The CTA is 16px of vertical padding on an 11px line — ~45px, clearing the
       44px tap-target floor. At 13px it measured 38.5px, which is under it.
   ========================================================================== */
function confirmationEmail(name: string) {
  const first = escapeHtml(name.split(/\s+/)[0] || 'you');

  /* The "real time" of this design. No JS runs in a mail client, but the HTML is
     generated at the moment of sending, so the clock and date on the handset are
     the minute THIS person hit submit. Everything is IST — the party is in
     Mumbai and so is the applicant; a UTC stamp would quietly be 5.5 hours wrong. */
  const IST = 'Asia/Kolkata';
  const now = new Date();
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const today = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, day: '2-digit', month: 'short',
  }).format(now).toUpperCase();

  /* ?arcade is a real door, not the homepage: it drops the gate, unlocks audio
     and opens the arcade directly, skipping the intro and the application flow.
     Same link the besties invite uses. If a link-tracking wrapper ever strips
     the query, this silently lands on the intro instead — which is not what the
     key promises — so leave click tracking OFF for this send. */
  const ARCADE = 'https://secretslumberparty.com/?arcade';

  const key = (digit: string, sub: string) =>
    `<td align="center" style="padding:2px 2px"><div style="background-color:#f3c6da;background-image:linear-gradient(180deg,#fff2f8 0%,#f8d7e6 47%,#e9b0c9 53%,#dda3bd 100%);border-top:1px solid #fffafc;border-left:1px solid #fffafc;border-right:1px solid #b8788f;border-bottom:1px solid #b8788f;border-radius:7px;padding:6px 0 5px"><div style="font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:bold;color:#4f2437;line-height:1.05">${digit}</div><div style="font-family:'Courier New',Courier,monospace;font-size:7px;color:#9a6178;letter-spacing:.08em">${sub}</div></div></td>`;

  const keypad = [
    ['1', '&#8734;'], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['&#10033;', '&#9829;'], ['0', '+'], ['#', '&#9734;'],
  ];
  const keyRows = [0, 3, 6, 9]
    .map((i) => `<tr>${keypad.slice(i, i + 3).map(([d, s]) => key(d, s)).join('')}</tr>`)
    .join('');

  return {
    // no emoji in the subject: it isn't decisive, but it's free to drop and
    // some filters still score it on a domain with no sending history
    subject: 'noted — khushi got your application',
    text: `hey ${name.split(/\s+/)[0] || 'you'},

your application's in — tucked in safe.

i'm gathering thirty to spill the tea. if you're one of them, i'll whisper back.

open the arcade: ${ARCADE}

—
you're getting this because you applied at secretslumberparty.com.
reply to this email if that wasn't you.`,
    html: `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>1 new message</title>
</head>
<body style="margin:0;padding:0;background-color:#ffe9f3">

<!-- preview text: the grey line beside the subject in the inbox list -->
<div style="display:none;font-size:1px;color:#ffe9f3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  1 new message from khushi &#9829; your application's tucked in safe
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="#ffe9f3" style="background-color:#ffe9f3;margin:0;padding:0">
  <tr><td align="center" style="padding:24px 8px 30px">

    <img src="cid:${LOGO_CID}" width="164" alt="(secret ;) khushi's SLUMBER PARTY"
         style="display:block;width:164px;max-width:60%;height:auto;border:0;outline:none" />

    <div style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#c9789a;
                letter-spacing:.42em;padding:12px 0 16px">&#10022; &#183; &#10023; &#183; &#10022;</div>

    <!-- stub antenna -->
    <table role="presentation" width="300" cellpadding="0" cellspacing="0" border="0"
           style="width:300px;max-width:100%">
      <tr><td align="right" style="padding:0 28px 0 0">
        <div style="width:26px;height:16px;background-color:#4a3a55;
                    border-top:2px solid #6f5c7d;border-left:2px solid #6f5c7d;
                    border-right:2px solid #241b2b;
                    border-radius:8px 8px 0 0;font-size:0;line-height:0">&nbsp;</div>
      </td></tr>
    </table>

    <!-- ==================== THE HANDSET ==================== -->
    <!-- chrome ring; the shadow separates a pink object from a pink ground.
         Outlook drops box-shadow and falls back to the ring, so the ring stays. -->
    <table role="presentation" width="300" cellpadding="0" cellspacing="0" border="0"
           style="width:300px;max-width:100%;background-color:#cbb3c2;
                  background-image:linear-gradient(160deg,#fff6fa 0%,#cbb3c2 32%,#9c7d90 72%,#eddbe6 100%);
                  border-radius:32px;box-shadow:0 14px 30px rgba(140,55,95,.26)">
      <tr><td style="padding:3px">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background-color:#e493b5;
                    background-image:linear-gradient(158deg,#f7c8dc 0%,#e493b5 38%,#c56d94 76%,#eaa9c6 100%);
                    border-radius:30px">

        <!-- speaker slot + power LED -->
        <tr><td align="center" style="padding:14px 0 0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:9px">
                <div style="width:78px;height:8px;background-color:#6d4258;
                            border-top:1px solid #b8768f;border-bottom:1px solid #ffd9e8;
                            border-radius:5px;font-size:0;line-height:0">&nbsp;</div>
              </td>
              <td>
                <div style="width:6px;height:6px;background-color:#7ee06a;
                            border:1px solid #3f8c33;border-radius:5px;
                            font-size:0;line-height:0">&nbsp;</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:8px 0 11px;font-family:'Courier New',Courier,monospace;
                   font-size:10px;font-weight:bold;color:#8a4f6c;letter-spacing:.44em">SLUMBER</td></tr>

        <!-- black screen window: the fascia panel the LCD sits inside -->
        <tr><td style="padding:0 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background-color:#18121e;
                        background-image:linear-gradient(170deg,#2b2233 0%,#18121e 40%,#120d17 100%);
                        border-top:1px solid #0c080f;border-left:1px solid #0c080f;
                        border-right:1px solid #6a5878;border-bottom:1px solid #6a5878;
                        border-radius:11px">
            <tr><td style="padding:13px 12px 15px">

              <!-- the LCD. Two layers: a diagonal sheen across the top-left (the
                   glass) over the flat panel colour. Outlook takes bgcolor. -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     bgcolor="#b9c49b" style="background-color:#b9c49b;
                     background-image:
                       linear-gradient(114deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,.16) 17%, rgba(255,255,255,0) 38%),
                       linear-gradient(180deg,#c5cfa9 0%,#b9c49b 55%,#a9b58a 100%);
                     border-top:1px solid #7d8a63;border-left:1px solid #7d8a63;
                     border-right:1px solid #d3dcbc;border-bottom:1px solid #d3dcbc">

                <tr><td style="padding:5px 7px 4px;border-bottom:1px solid #98a67c">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:'Courier New',Courier,monospace;font-size:9px;
                                 color:#2a3119;letter-spacing:.04em;white-space:nowrap">
                        &#9601;&#9603;&#9605;&#9607; SLUMBER
                      </td>
                      <td align="right" style="font-family:'Courier New',Courier,monospace;font-size:9px;
                                 color:#2a3119;letter-spacing:.04em;white-space:nowrap">
                        ${clock} &#9646;&#9646;&#9646;
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <tr><td style="padding:7px 8px 0;font-family:'Courier New',Courier,monospace;
                           font-size:10px;color:#4d5732;letter-spacing:.13em">&#9993; INBOX &#183; 1 NEW</td></tr>

                <tr><td style="padding:5px 8px 0;font-family:'Courier New',Courier,monospace;
                           font-size:14px;font-weight:bold;color:#222819;letter-spacing:.02em">
                  KHUSHI <span style="color:#9c1f52">&#9829;</span>
                  <span style="font-weight:normal;font-size:9px;color:#5a6440">&#183; ${today}</span>
                </td></tr>

                <tr><td style="padding:6px 8px 0">
                  <div style="border-top:1px dashed #98a67c;font-size:0;line-height:0">&nbsp;</div>
                </td></tr>

                <tr><td style="padding:9px 8px 0;font-family:'Courier New',Courier,monospace;
                           font-size:14px;line-height:1.55;color:#222819">
                  hey ${first} <span style="color:#9c1f52">&#9829;</span>
                </td></tr>
                <tr><td style="padding:7px 8px 0;font-family:'Courier New',Courier,monospace;
                           font-size:13px;line-height:1.6;color:#333b22">
                  your application's in &#8212; tucked in safe.
                </td></tr>
                <tr><td style="padding:6px 8px 0;font-family:'Courier New',Courier,monospace;
                           font-size:13px;line-height:1.6;color:#333b22">
                  i'm gathering thirty to spill the tea. if you're one of
                  them, i'll whisper back. &#10024;
                </td></tr>

                <tr><td style="padding:12px 0 0">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border-top:1px solid #98a67c">
                    <tr>
                      <td style="padding:4px 7px;font-family:'Courier New',Courier,monospace;
                                 font-size:9px;color:#4d5732;letter-spacing:.07em">SELECT</td>
                      <td align="right" style="padding:4px 7px;font-family:'Courier New',Courier,monospace;
                                 font-size:9px;color:#4d5732;letter-spacing:.07em">BACK</td>
                    </tr>
                  </table>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- faceplate seam: Y2K covers came off, and the join always showed -->
        <tr><td style="padding:13px 12px 0">
          <div style="border-top:1px solid #b7708f;border-bottom:1px solid #f6c3d9;
                      font-size:0;line-height:0">&nbsp;</div>
        </td></tr>

        <!-- nav cluster: call / action / end -->
        <tr><td style="padding:12px 16px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="44" align="center" valign="middle">
                <div style="background-color:#57a343;
                            background-image:linear-gradient(180deg,#8fd97c 0%,#63b04e 47%,#4b9339 53%,#3d8130 100%);
                            border-top:1px solid #a9e79a;border-left:1px solid #a9e79a;
                            border-right:1px solid #2c631f;border-bottom:1px solid #2c631f;
                            border-radius:13px 4px 8px 13px;padding:11px 0;
                            font-family:'Courier New',Courier,monospace;font-size:14px;
                            color:#f0ffe9;line-height:1">&#9742;</div>
              </td>

              <td align="center" valign="middle" style="padding:0 8px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background-color:#2b2033;
                              background-image:linear-gradient(180deg,#4a3b56 0%,#332741 47%,#241a2d 53%,#1b1322 100%);
                              border-top:1px solid #74608a;border-left:1px solid #74608a;
                              border-right:1px solid #130d18;border-bottom:1px solid #130d18;
                              border-radius:19px">
                  <tr><td align="center">
                    <a href="${ARCADE}"
                       style="display:block;padding:16px 6px;font-family:'Courier New',Courier,monospace;
                              font-size:11px;font-weight:bold;color:#ffd3e4;text-decoration:none;
                              letter-spacing:.08em">&#9658; OPEN ARCADE</a>
                  </td></tr>
                </table>
              </td>

              <td width="44" align="center" valign="middle">
                <div style="background-color:#c0392b;
                            background-image:linear-gradient(180deg,#ec8b7e 0%,#cd5142 47%,#ad3527 53%,#932a1d 100%);
                            border-top:1px solid #f0a99e;border-left:1px solid #f0a99e;
                            border-right:1px solid #7d2018;border-bottom:1px solid #7d2018;
                            border-radius:4px 13px 13px 8px;padding:11px 0;
                            font-family:'Courier New',Courier,monospace;font-size:14px;
                            color:#fff0ed;line-height:1">&#9743;</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- T9 keypad -->
        <tr><td style="padding:10px 16px 22px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${keyRows}
          </table>
        </td></tr>

      </table>
      </td></tr>
    </table>
    <!-- ==================== /THE HANDSET ==================== -->

    <div style="font-family:'Courier New',Courier,monospace;font-size:15px;color:#c9789a;
                letter-spacing:.26em;padding:13px 0 0">&#183;&#183;&#9679;&#10022;&#9829;</div>

    <table role="presentation" width="300" cellpadding="0" cellspacing="0" border="0"
           style="width:300px;max-width:100%">
      <tr><td align="center" style="padding:18px 8px 0;font-family:'Courier New',Courier,monospace;
                 font-size:11px;line-height:1.7;color:#8a5670">
        you're getting this because you applied at<br>
        <a href="https://secretslumberparty.com" style="color:#d4568a;text-decoration:none">secretslumberparty.com</a>
        <span style="color:#eb648c">&#9829;</span><br>
        reply to this email if that wasn't you.
      </td></tr>
    </table>

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
          /* The wordmark travels WITH the message rather than being fetched from
             the site. Gmail and Outlook hide remote images from unknown senders
             by default — which is every recipient here — so a hosted <img> is a
             blank space on first open. content_id is what binds it to the
             src="cid:slumberlogo" in the HTML above. */
          attachments: [{
            filename: 'logo.png',
            content: LOGO_B64,
            content_id: LOGO_CID,
            content_type: 'image/png',
          }],
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
