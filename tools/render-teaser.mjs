// ============================================================================
//  Render the teaser email ("sorry I've been MIA!") to files you can open.
//
//    node --experimental-strip-types tools/render-teaser.mjs
//
//  tools/out/teaser.html        what Apple Mail / iOS Mail get (fonts + motion)
//  tools/out/teaser-gmail.html  the same with <style> and the font <link>
//                               removed: roughly what Gmail and Outlook keep
//  tools/out/teaser.txt         the plain-text twin
//
//  Images are cid: attachments in a real send; here they're inlined so a
//  browser shows them.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teaserEmail } from '../supabase/functions/_shared/thread-email.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mail = teaserEmail({
  firstName: 'Riya Sharma',
  link: 'https://access.nailin.it/?i=PREVIEWTOKEN',
  optOutUrl: 'https://secseoyetyfqsfgzlnis.supabase.co/functions/v1/teaser?optout=PREVIEWTOKEN',
});

const data = (f, type) => `data:${type};base64,${fs.readFileSync(path.join(root, f)).toString('base64')}`;
const inline = (html) => html
  .replace(/cid:preview/g, data('assets/email/chat-preview.png', 'image/png'))
  .replace(/cid:khushi/g, data('assets/email/khushi-avatar.png', 'image/png'));
const gmailish = (html) => html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<link [^>]*fonts\.googleapis[^>]*>/, '');

const out = path.join(root, 'tools/out');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'teaser.html'), inline(mail.html));
fs.writeFileSync(path.join(out, 'teaser-gmail.html'), inline(gmailish(mail.html)));
fs.writeFileSync(path.join(out, 'teaser.txt'), `Subject: ${mail.subject}\n\n${mail.text}\n`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(`subject   ${mail.subject}`);
console.log(`html      ${kb(mail.html)}KB (Gmail clips messages over ~102KB)`);
console.log(`wrote ${path.relative(process.cwd(), out)}/teaser.html, teaser-gmail.html, teaser.txt`);
