// ============================================================================
//  /functions/v1/teaser — sends "sorry I've been MIA!" and handles its opt-out.
//
//    POST {action:'test', to}   x-teaser-key   → one real send, to an address
//                                               in teaser_test_recipients only
//    GET  ?optout=<token>                       → "no thanks" from the email
//    POST ?optout=<token>                       → the same, one-click
//                                               (List-Unsubscribe-Post)
//
//  Every send mints that applicant's personal link: a random token whose
//  sha256('inv:' || token) goes in prebuzz_invites, the token itself only in the
//  email. The OPEN THE CHAT button is access.nailin.it/?i=<token>; the prebuzz
//  function's `invite` action turns it into their seat in the secret group,
//  greeted by first name. The same token is their opt-out key.
//
//  There is deliberately no bulk action yet: the real send is switched on
//  separately, after the test has been checked in real inboxes.
//
//  Deploy:  supabase functions deploy teaser --no-verify-jwt   (auth is the key)
//  Keys:    sha256 of each x-teaser-key lives in teaser_keys, the test
//           allowlist in teaser_test_recipients (both service-role only).
//  Secrets: RESEND_API_KEY, optional TEASER_FROM / TEASER_REPLY_TO /
//           TEASER_ASSET_BASE / TEASER_ACCESS_URL
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { teaserEmail, sendTeaserEmail } from '../_shared/thread-email.ts';

const ACCESS_URL = Deno.env.get('TEASER_ACCESS_URL') ?? 'https://access.nailin.it/';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const page = (msg: string) => new Response(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>khushi</title>
<body style="margin:0;background:#1c1017;color:#fff6f8;font-family:'Courier New',monospace;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px">
<p style="font-size:18px;line-height:1.5;max-width:320px">${msg}</p></body>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // ------------------------------------------------------------- opt-out
  const optout = url.searchParams.get('optout');
  if (optout !== null && (req.method === 'GET' || req.method === 'POST')) {
    const { data: inv } = await db.from('prebuzz_invites').select('token_hash, email')
      .eq('token_hash', await sha(`inv:${optout.slice(0, 100)}`)).single();
    if (inv) {
      await db.from('email_optouts').upsert({ email: inv.email, source: 'teaser' }, { onConflict: 'email', ignoreDuplicates: true });
      await db.from('prebuzz_invites').update({ opted_out_at: new Date().toISOString() }).eq('token_hash', inv.token_hash);
    }
    // the same answer either way, so the link can't be used to test addresses
    return req.method === 'POST' ? json({ ok: true }) : page("done ♡ you won't get these from us again.");
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const key = req.headers.get('x-teaser-key') ?? '';
  const { data: k } = key.length >= 32
    ? await db.from('teaser_keys').select('key_hash').eq('key_hash', await sha(`key:${key}`)).maybeSingle()
    : { data: null };
  if (!k) return json({ error: 'forbidden' }, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  // ----------------------------------------------------------------- test
  if (b.action === 'test') {
    const to = String(b.to ?? '').trim().toLowerCase();
    const { data: allowed } = await db.from('teaser_test_recipients').select('email').eq('email', to).maybeSingle();
    if (!allowed) return json({ error: 'not a test address' }, 400);

    const { data: app } = await db.from('applications').select('id, name, email')
      .ilike('email', to).order('created_at', { ascending: false }).limit(1).single();
    if (!app) return json({ error: 'no application with that email' }, 404);
    const { data: out } = await db.from('email_optouts').select('email').eq('email', to).maybeSingle();
    if (out) return json({ error: 'opted out' }, 409);

    const token = newToken();
    const tokenHash = await sha(`inv:${token}`);
    const { error: insErr } = await db.from('prebuzz_invites').insert({ token_hash: tokenHash, application_id: app.id, email: to });
    if (insErr) return json({ error: 'invite', detail: insErr.message }, 500);

    const link = `${ACCESS_URL}?i=${encodeURIComponent(token)}`;
    const optOutUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/teaser?optout=${encodeURIComponent(token)}`;
    const mail = teaserEmail({ firstName: app.name ?? '', link, optOutUrl });
    const r = await sendTeaserEmail(to, { ...mail, subject: `[TEST] ${mail.subject}` }, optOutUrl);

    await db.from('prebuzz_invites').update(r.sent
      ? { sent_at: new Date().toISOString(), resend_id: r.id ?? null }
      : { send_error: r.reason ?? 'unknown' }).eq('token_hash', tokenHash);
    // the link itself is never returned: it exists only in the inbox it was sent to
    return json({ ok: r.sent, id: r.id, reason: r.reason });
  }

  return json({ error: 'unknown action' }, 400);
});
