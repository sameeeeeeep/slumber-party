// ============================================================================
//  The thread email: khushi's texts, the way /late shows them.
//
//  The first nailinit email ("sorry I've been MIA!") goes to every slumber
//  applicant. It looks like the /late chat: a wine background, cream bubbles,
//  the pink-to-orange pill. It ends on ONE button, to the person's own page on
//  nailin.it, where the photos the email shows blurred are shown clear.
//
//  THE RULES IT OBEYS (same as handset-email.ts, for the same reasons)
//    · TABLES AND INLINE STYLES carry the whole design. The <style> block only
//      ADDS motion for clients that run it; delete it and nothing is missing.
//    · NOTHING STARTS HIDDEN. Bubbles animate FROM opacity 0 with
//      fill-mode: backwards, so a client that keeps the class but drops the
//      @keyframes (Gmail does) shows every bubble at once instead of none.
//    · EVERY COLOUR IS EXPLICIT, bgcolor attribute and CSS both, so dark mode
//      has nothing to guess at.
//    · IMAGES TRAVEL WITH THE MESSAGE (cid:), because the blurred grid is the
//      hook and Outlook hides remote images from a new sender.
//    · A PLAIN-TEXT TWIN, always.
//    · NO TYPING DOTS, NO "ONLINE". It is labelled a note from khushi; it never
//      pretends she is texting this person live.
//
//  The pixel font (VT323) loads where web fonts work (Apple Mail, iOS Mail).
//  Elsewhere the stack falls to Courier New, and the sizes below are chosen
//  for Courier, the larger of the two, so neither version overflows a bubble.
// ============================================================================
import { escapeHtml } from './handset-email.ts';
import { LEAKS_JPG_B64, AVATAR_PNG_B64 } from './teaser-assets.ts';

export const LEAKS_CID = 'leaks';
export const AVATAR_CID = 'khushi';

export interface TeaserInput {
  /** First name as the person typed it on the application. Empty → "hi!". */
  firstName: string;
  /** Their personal page, e.g. https://nailin.it/pages/khushis-list?k=<token>.
   *  The token is random: the link must never carry their email or name. */
  link: string;
  /** HTTPS one-click opt-out for this person (also sent as List-Unsubscribe). */
  optOutUrl: string;
  /** The application count Khushi quotes, e.g. "25,000+". Passed in rather than
   *  written here so the number is a decision made at send time, not a constant
   *  nobody re-checks. The database held 14,688 completed applications when this
   *  was written; /late says "20,000+". */
  appliedCount: string;
  /** How many spots there were, as she'd say it ("two"). /late says "thirty-five". */
  spots: string;
}

const FONT = "'VT323','Courier New',Courier,monospace";
const PIXEL = "'Press Start 2P','Courier New',Courier,monospace";

export function teaserEmail(input: TeaserInput): { subject: string; html: string; text: string } {
  const name = input.firstName.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const hi = name ? `hi ${escapeHtml(name)}!` : 'hi!';
  const link = escapeHtml(input.link);
  const optOut = escapeHtml(input.optOutUrl);

  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date()).replace(' ', '').toLowerCase();

  const lines = [
    hi,
    'remember the slumber party?',
    'well&#8230; it kinda happened',
    "and i'm so bummed i couldn't get you in",
    `but but in my defense, ${escapeHtml(input.appliedCount)} girlies applied for ${escapeHtml(input.spots)} open spots. it was insane`,
    'thank you for all the love, seriously',
    "but since you applied, i'm letting you in on a secret",
    "i've been building a brand. the last few months have gone into making sure what comes out is something unimaginable",
    'here are some leaked pictures btw',
  ];

  /* One cream bubble. The outer div only exists to carry the animation class:
     Apple Mail animates a div reliably, a table cell less so. */
  const bubble = (html: string, n: number) => `
        <tr><td align="left" style="padding:0 0 8px 0">
          <div class="b" style="animation-delay:${(0.15 + n * 0.32).toFixed(2)}s">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:86%">
            <tr><td bgcolor="#fff6f8" class="t" style="background-color:#fff6f8;border-radius:18px;padding:9px 14px;
                       font-family:${FONT};font-size:17px;line-height:1.4;color:#2b1a22">${html}</td></tr>
          </table>
          </div>
        </td></tr>`;

  const after = lines.length;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>a note from khushi</title>
<link href="https://fonts.googleapis.com/css2?family=VT323&amp;family=Press+Start+2P&amp;display=swap" rel="stylesheet" />
<style>
  /* Motion only. Every rule here is optional; see the header comment. */
  @keyframes pop { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:none; } }
  @keyframes glow { 0%,100% { box-shadow:0 6px 16px rgba(235,100,140,.35); } 50% { box-shadow:0 6px 30px rgba(236,100,42,.75); } }
  .b { animation:pop .38s ease-out backwards; }
  .cta { animation:glow 2.4s ease-in-out ${(0.15 + (after + 3) * 0.32).toFixed(2)}s infinite; }
  .peek { transition:transform .25s ease; }
  .peek:hover { transform:rotate(-1.5deg) scale(1.02); }
  /* Sizes inline are for Courier, the fallback. VT323 runs small, so where
     web fonts load (Apple Mail, iOS Mail) it gets bigger type. Gmail drops
     @supports blocks entirely, so Courier never sees these sizes. */
  @supports (-webkit-appearance:none) {
    .t { font-size:21px !important; line-height:1.3 !important; }
    .s { font-size:17px !important; }
    .n { font-size:23px !important; }
  }
  @media (prefers-reduced-motion: reduce) { .b, .cta { animation:none !important; } .peek:hover { transform:none; } }
</style>
</head>
<body style="margin:0;padding:0;background-color:#1c1017">

<!-- preview text: the grey line beside the subject in the inbox list -->
<div style="display:none;font-size:1px;color:#1c1017;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  remember the slumber party? well&#8230; it kinda happened
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="#1c1017" style="background-color:#1c1017;margin:0;padding:0">
  <tr><td align="center" style="padding:0">

    <!--[if mso]><table role="presentation" width="420" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           bgcolor="#2a1520" style="width:100%;max-width:420px;background-color:#2a1520;
           background-image:linear-gradient(180deg,#3a1a2a 0%,#2a1520 30%,#1c1017 100%)">

      <!-- header: who it's from -->
      <tr><td style="padding:18px 16px 14px;border-bottom:1px solid #3d2430">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding:0 12px 0 0">
            <img src="cid:${AVATAR_CID}" width="44" height="44" alt=""
                 style="display:block;width:44px;height:44px;border-radius:22px;border:2px solid #eb648c;background-color:#fde3ea" />
          </td>
          <td valign="middle" style="font-family:${FONT};line-height:1.15">
            <div class="n" style="font-size:19px;font-weight:bold;color:#fff6f8">khushi</div>
            <div class="s" style="font-size:14px;color:#c9a0ae">a note from khushi</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- the thread -->
      <tr><td style="padding:14px 14px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:0 0 12px">
          <span style="display:inline-block;background-color:#3a2230;color:#c9a0ae;border-radius:10px;padding:3px 12px;
                       font-family:${FONT};font-size:14px">today &#183; ${stamp}</span>
        </td></tr>
${lines.map((l, i) => bubble(l, i)).join('')}

        <!-- the leaks: one pre-blurred image, linked to their page -->
        <tr><td align="left" style="padding:0 0 8px 0">
          <div class="b" style="animation-delay:${(0.15 + after * 0.32).toFixed(2)}s">
          <a href="${link}" class="peek" style="display:block;width:260px;max-width:86%;text-decoration:none">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td bgcolor="#fff6f8" style="background-color:#fff6f8;border-radius:18px;padding:7px">
                <img src="cid:${LEAKS_CID}" width="246" alt="4 leaked pictures, blurred. tap to see them"
                     style="display:block;width:100%;height:auto;border:0;border-radius:12px" />
              </td></tr>
            </table>
          </a>
          </div>
        </td></tr>
${bubble('i made you a link. something exclusive, just for you &#8595;', after + 1)}
        </table>
      </td></tr>

      <!-- the one button -->
      <tr><td style="padding:10px 14px 22px">
        <div class="b" style="animation-delay:${(0.15 + (after + 2) * 0.32).toFixed(2)}s">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="#eb648c" class="cta"
                  style="background-color:#eb648c;background-image:linear-gradient(90deg,#eb648c,#ec642a);
                         border-radius:27px;box-shadow:0 6px 16px rgba(235,100,140,.35)">
            <a href="${link}" style="display:block;padding:18px 12px;font-family:${PIXEL};font-size:12px;
                       letter-spacing:.06em;color:#ffffff;text-decoration:none;font-weight:bold">SEE IT FIRST &#9656;</a>
          </td></tr>
        </table>
        </div>
      </td></tr>

      <!-- why you got this, and the way out -->
      <tr><td align="center" class="s" style="padding:0 30px 26px;font-family:${FONT};font-size:13px;line-height:1.45;color:#9c7d89">
        you're getting this because you applied for khushi's slumber party at secretslumberparty.com.
        nailinit is khushi's brand. not interested?
        <a href="${optOut}" style="color:#ffd9e4;text-decoration:underline">no thanks</a> and we won't email you about it again.
      </td></tr>

    </table>
    <!--[if mso]></td></tr></table><![endif]-->

  </td></tr>
</table>
</body></html>`;

  const text = `${name ? `hi ${name}!` : 'hi!'}

remember the slumber party?
well... it kinda happened
and i'm so bummed i couldn't get you in

but but in my defense, ${input.appliedCount} girlies applied for ${input.spots} open spots. it was insane
thank you for all the love, seriously

but since you applied, i'm letting you in on a secret
i've been building a brand. the last few months have gone into making sure what comes out is something unimaginable

here are some leaked pictures btw, and i made you a link. something exclusive, just for you:
${input.link}

khushi

--
you're getting this because you applied for khushi's slumber party at secretslumberparty.com. nailinit is khushi's brand.
not interested? ${input.optOutUrl}`;

  return { subject: "sorry I've been MIA!", html, text };
}

/* Sends one teaser. Mirrors sendHandsetEmail's posture (multipart, never
   throws, reason for the caller's log only) with two differences: its own
   images, and an HTTPS one-click unsubscribe, which Gmail and Yahoo require of
   bulk senders. The mailto in handset-email.ts doesn't meet that bar. */
export async function sendTeaserEmail(
  to: string,
  mail: { subject: string; html: string; text: string },
  optOutUrl: string,
): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { sent: false, reason: 'no RESEND_API_KEY' };
  const replyTo = Deno.env.get('MAIL_REPLY_TO') ?? 'khushi@nailin.it';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? 'khushi from nailinit <khushi@nailin.it>',
        to: [to],
        reply_to: replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [
          { filename: 'leaks.jpg', content: LEAKS_JPG_B64, content_id: LEAKS_CID, content_type: 'image/jpeg' },
          { filename: 'khushi.png', content: AVATAR_PNG_B64, content_id: AVATAR_CID, content_type: 'image/png' },
        ],
        headers: {
          'List-Unsubscribe': `<${optOutUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    if (res.ok) return { sent: true, id: (await res.json()).id };
    const why = (await res.text()).slice(0, 400);
    console.error('resend rejected', res.status, why);
    return { sent: false, reason: `${res.status} ${why}` };
  } catch (e) {
    console.error('resend threw', e);
    return { sent: false, reason: 'threw: ' + String(e).slice(0, 300) };
  }
}
