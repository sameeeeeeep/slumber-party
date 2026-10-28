// ============================================================================
//  The thread email: khushi's texts, the way /late shows them.
//
//  The first nailinit email ("sorry I've been MIA!") goes to every slumber
//  applicant. It is deliberately short: khushi "online" with a glowing green
//  dot, three messages, the rest of the chat blurred behind "+12 new messages",
//  and ONE big button to her chat on nailin.it, where the whole thing plays out
//  (photos, the 25,000 shout, drumrolls, the leaks, follow on Instagram). The
//  email's only job is to get the tap.
//
//  THE RULES IT OBEYS (same as handset-email.ts, for the same reasons)
//    · TABLES AND INLINE STYLES carry the whole design. The <style> block only
//      ADDS motion for clients that run it; delete it and nothing is missing.
//    · NOTHING STARTS HIDDEN. Bubbles animate FROM opacity 0 with
//      fill-mode: backwards, so a client that keeps the class but drops the
//      @keyframes (Gmail does) shows every bubble at once instead of none.
//    · EVERY COLOUR IS EXPLICIT, bgcolor attribute and CSS both, so dark mode
//      has nothing to guess at.
//    · IMAGES TRAVEL WITH THE MESSAGE (cid:), because the blurred preview is
//      the hook and Outlook hides remote images from a new sender. The preview
//      is one pre-made picture (tools/blur-leaks.py): the mockup's blurred
//      block with the "+12 new messages" pill drawn on it, because email can't
//      blur live content or lay text over an image.
//    · A PLAIN-TEXT TWIN, always.
//
//  The pixel font (VT323) loads where web fonts work (Apple Mail, iOS Mail).
//  Elsewhere the stack falls to Courier New, and the sizes below are chosen
//  for Courier, the larger of the two, so neither version overflows a bubble.
// ============================================================================
/* Kept here rather than imported from handset-email.ts, so the teaser function
   deploys as two small files without dragging in the handset's inline logo. */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* The two pictures, fetched when sending and attached to each message (cid:).
   They live in this repo's assets/email/, built by tools/blur-leaks.py, and
   are read from main. For the real send set TEASER_ASSET_BASE to the same URL
   with a commit hash in place of `main`, so nothing pushed mid-send changes
   the email. */
export const ASSET_BASE_DEFAULT =
  'https://raw.githubusercontent.com/sameeeeeeep/slumber-party/main/assets/email/';
const ASSETS = [
  { file: 'chat-preview.png', cid: 'preview', type: 'image/png' },
  { file: 'khushi-avatar.png', cid: 'khushi', type: 'image/png' },
];
let assetCache: { filename: string; content: string; content_id: string; content_type: string }[] | null = null;
export async function teaserAttachments(base = ASSET_BASE_DEFAULT) {
  if (assetCache) return assetCache;
  assetCache = await Promise.all(ASSETS.map(async (a) => {
    const res = await fetch(base + a.file);
    if (!res.ok) throw new Error(`asset ${a.file}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { filename: a.file, content: btoa(bin), content_id: a.cid, content_type: a.type };
  }));
  return assetCache;
}

export const PREVIEW_CID = 'preview';
/** Messages waiting on the site after the email's three. Keep in step with the
 *  site's chat; blur-leaks.py reads this line to draw the pill, so rebuild the
 *  picture after changing it. */
export const PREVIEW_COUNT = 12;
export const AVATAR_CID = 'khushi';

export interface TeaserInput {
  /** First name as the person typed it on the application. Empty → "hi!". */
  firstName: string;
  /** Their personal chat link, https://access.nailin.it/?i=<token>.
   *  The token is random: the link must never carry their email or name. */
  link: string;
  /** HTTPS one-click opt-out for this person (also sent as List-Unsubscribe). */
  optOutUrl: string;
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

  const lines = [hi, 'remember the slumber party?', 'well&#8230; it happened. and i have something for you'];

  /* One cream bubble. The outer div only exists to carry the animation class:
     Apple Mail animates a div reliably, a table cell less so. */
  const bubble = (html: string, n: number) => `
        <tr><td align="left" style="padding:0 0 8px 0">
          <div class="b" style="animation-delay:${(0.15 + n * 0.35).toFixed(2)}s">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:84%">
            <tr><td bgcolor="#fff6f8" class="t" style="background-color:#fff6f8;border-radius:18px;padding:9px 14px;
                       font-family:${FONT};font-size:17px;line-height:1.4;color:#2b1a22">${html}</td></tr>
          </table>
          </div>
        </td></tr>`;

  const previewAt = (0.15 + lines.length * 0.35).toFixed(2);
  const ctaAt = (0.15 + (lines.length + 1) * 0.35).toFixed(2);
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>khushi</title>
<link href="https://fonts.googleapis.com/css2?family=VT323&amp;family=Press+Start+2P&amp;display=swap" rel="stylesheet" />
<style>
  /* Motion only. Every rule here is optional; see the header comment. */
  @keyframes pop { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:none; } }
  @keyframes glow { 0%,100% { box-shadow:0 8px 20px rgba(235,100,140,.4); } 50% { box-shadow:0 8px 36px rgba(236,100,42,.85); } }
  @keyframes live { 0%,100% { box-shadow:0 0 4px 1px rgba(74,222,128,.55); } 50% { box-shadow:0 0 10px 4px rgba(74,222,128,.9); } }
  .b { animation:pop .38s ease-out backwards; }
  .live { animation:live 1.8s ease-in-out infinite; }
  .cta { animation:glow 2.4s ease-in-out ${(Number(ctaAt) + 0.6).toFixed(2)}s infinite; }
  /* Sizes inline are for Courier, the fallback. VT323 runs small, so where
     web fonts load (Apple Mail, iOS Mail) it gets bigger type. Gmail drops
     @supports blocks entirely, so Courier never sees these sizes. */
  @supports (-webkit-appearance:none) {
    .t { font-size:21px !important; line-height:1.3 !important; }
    .s { font-size:17px !important; }
    .n { font-size:23px !important; }
  }
  @media (prefers-reduced-motion: reduce) { .b, .cta, .live { animation:none !important; } }
</style>
</head>
<body style="margin:0;padding:0;background-color:#1c1017">

<!-- preview text: the grey line beside the subject in the inbox list -->
<div style="display:none;font-size:1px;color:#1c1017;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  remember the slumber party? well&#8230; it happened
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="#1c1017" style="background-color:#1c1017;margin:0;padding:0">
  <tr><td align="center" style="padding:0">

    <!--[if mso]><table role="presentation" width="420" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <!-- The mockup's gradient, flattened to #2a1520 through the middle so the
         preview picture (which has that colour baked in) blends in whether or
         not the client draws gradients. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           bgcolor="#2a1520" style="width:100%;max-width:420px;background-color:#2a1520;
           background-image:linear-gradient(180deg,#3a1a2a 0%,#2a1520 12%,#2a1520 82%,#1c1017 100%)">

      <!-- header: khushi, online -->
      <tr><td style="padding:18px 16px 14px;border-bottom:1px solid #3d2430">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding:0 12px 0 0">
            <img src="cid:${AVATAR_CID}" width="44" height="44" alt=""
                 style="display:block;width:44px;height:44px;border-radius:22px;border:2px solid #eb648c;background-color:#fde3ea" />
          </td>
          <td valign="middle" style="font-family:${FONT};line-height:1.15">
            <div class="n" style="font-size:19px;font-weight:bold;color:#fff6f8">khushi</div>
            <div class="s" style="font-size:14px;color:#4ade80"><span class="live" style="display:inline-block;width:9px;height:9px;border-radius:5px;background-color:#4ade80;box-shadow:0 0 6px 2px rgba(74,222,128,.7);vertical-align:middle;margin:0 6px 2px 0"></span>online</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- the thread -->
      <tr><td style="padding:14px 14px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:0 0 12px">
          <span style="display:inline-block;background-color:#3a2230;color:#c9a0ae;border-radius:10px;padding:3px 12px;
                       font-family:${FONT};font-size:14px">today &#183; ${stamp}</span>
        </td></tr>
${lines.map((l, i) => bubble(l, i)).join('')}
        </table>
      </td></tr>

      <!-- the rest of the chat, blurred, "+12 new messages" on top: one picture,
           the card's full width so the blur spills into the margin as in the mockup -->
      <tr><td style="padding:0">
        <div class="b" style="animation-delay:${previewAt}s">
        <a href="${link}" style="display:block;text-decoration:none">
          <img src="cid:${PREVIEW_CID}" width="420" alt="+${PREVIEW_COUNT} new messages. open the chat to read them"
               style="display:block;width:100%;max-width:420px;height:auto;border:0" />
        </a>
        </div>
      </td></tr>

      <!-- the one button -->
      <tr><td style="padding:16px 14px 18px">
        <div class="b" style="animation-delay:${ctaAt}s">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="#eb648c" class="cta"
                  style="background-color:#eb648c;background-image:linear-gradient(90deg,#eb648c,#ec642a);
                         border-radius:32px;box-shadow:0 8px 20px rgba(235,100,140,.4)">
            <a href="${link}" style="display:block;padding:24px 12px;font-family:${PIXEL};font-size:14px;
                       letter-spacing:.06em;color:#ffffff;text-decoration:none;font-weight:bold">OPEN THE CHAT &#9656;</a>
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
well... it happened. and i have something for you

+${PREVIEW_COUNT} new messages. open the chat:
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
  // a key pasted with quotes or a trailing newline is the usual "API key is invalid"
  const key = (Deno.env.get('RESEND_API_KEY') ?? '').trim().replace(/^["']|["']$/g, '');
  if (!key) return { sent: false, reason: 'no RESEND_API_KEY' };
  const replyTo = Deno.env.get('TEASER_REPLY_TO') ?? Deno.env.get('MAIL_REPLY_TO') ?? 'khushi@nailin.it';
  try {
    const attachments = await teaserAttachments(Deno.env.get('TEASER_ASSET_BASE') ?? ASSET_BASE_DEFAULT);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        /* khushi@nailin.it once nailin.it is verified in Resend (TEASER_FROM);
           until then the slumber site's verified sender. */
        from: Deno.env.get('TEASER_FROM') ?? Deno.env.get('MAIL_FROM') ?? 'khushi <khushi@send.secretslumberparty.com>',
        to: [to],
        reply_to: replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments,
        headers: {
          'List-Unsubscribe': `<${optOutUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    if (res.ok) return { sent: true, id: (await res.json()).id };
    const why = (await res.text()).slice(0, 400);
    console.error('resend rejected', res.status, why);
    // its shape only, never the key, so a bad paste can be told from a revoked key
    const shape = res.status === 401 ? ` [key: ${key.length} chars, ${key.startsWith('re_') ? 're_' : 'not re_'}]` : '';
    return { sent: false, reason: `${res.status} ${why}${shape}` };
  } catch (e) {
    console.error('teaser send threw', e);
    return { sent: false, reason: 'threw: ' + String(e).slice(0, 300) };
  }
}
