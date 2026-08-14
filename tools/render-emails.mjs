// ============================================================================
//  Render every handset email to a file, so a change to the words or the phone
//  can be looked at before it is mailed to a stranger.
//
//    node --experimental-strip-types tools/render-emails.mjs
//
//  Writes tools/out/confirmation.html and tools/out/waitlist.html. Open them in
//  a browser — that is a rough preview, not a mail client, so it tells you the
//  layout is right, not that Gmail will keep it. The clock and date on the LCD
//  are whatever time you run this, exactly as they would be at send time.
//
//  The copy below is a MIRROR of the two edge functions, not the source of it:
//  the functions can't be imported here because they call Deno.serve at the top
//  level. The assertions at the bottom fail loudly if the two drift apart.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handsetEmail } from '../supabase/functions/_shared/handset-email.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCADE = 'https://secretslumberparty.com/?arcade';

const confirmation = handsetEmail({
  subject: 'noted — khushi got your application',
  preview: "1 new message from khushi &#9829; your application's tucked in safe",
  greetingName: 'riya',
  lines: [
    "your application's in &#8212; tucked in safe.",
    "i'm gathering thirty to spill the tea. if you're one of them, i'll whisper back. &#10024;",
  ],
  cta: { label: '&#9658; OPEN ARCADE', href: ARCADE },
  footerReason: "you're getting this because you applied at",
  text: '(see submit/index.ts)',
});

const waitlist = handsetEmail({
  subject: 'noted — you got on the list after all',
  preview: '1 new message from khushi &#9829; you missed the door, not the night',
  greetingName: 'you',
  lines: [
    'you missed the applications &#8212; but not the rest of it.',
    "i'm keeping this list for whatever comes next. you'll hear it here first. &#10024;",
    "and the surprise i promised: the arcade's open. &#129323;",
  ],
  cta: { label: '&#9658; OPEN ARCADE', href: ARCADE },
  footerReason: "you're getting this because you left your email at",
  text: '(see waitlist/index.ts)',
});

// the logo is a cid: attachment in the real send; inline it so a browser shows it
const inlineLogo = (html) => {
  const b64 = fs.readFileSync(path.join(root, 'supabase/functions/_shared/handset-email.ts'), 'utf8')
    .match(/^export const LOGO_B64 = '(.*)';$/m)?.[1]
    ?? fs.readFileSync(path.join(root, 'supabase/functions/_shared/handset-email.ts'), 'utf8')
      .match(/^const LOGO_B64 = '(.*)';$/m)[1];
  return html.replace(/src="cid:slumberlogo"/g, `src="data:image/png;base64,${b64}"`);
};

const out = path.join(root, 'tools/out');
fs.mkdirSync(out, { recursive: true });
for (const [name, mail] of [['confirmation', confirmation], ['waitlist', waitlist]]) {
  fs.writeFileSync(path.join(out, `${name}.html`), inlineLogo(mail.html));
  console.log(`${name.padEnd(13)} ${mail.subject}`);
}

// ---- drift guard ------------------------------------------------------------
// Every line of copy above must appear verbatim in the function that sends it.
const check = (file, needles) => {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  for (const n of needles) {
    if (!src.includes(n)) {
      console.error(`\nDRIFT: ${file} no longer contains\n  ${n}`);
      process.exitCode = 1;
    }
  }
};
check('supabase/functions/submit/index.ts', [confirmation.subject, ...[
  "your application's in &#8212; tucked in safe.",
  "i'm gathering thirty to spill the tea. if you're one of them, i'll whisper back. &#10024;",
]]);
check('supabase/functions/waitlist/index.ts', [waitlist.subject, ...[
  'you missed the applications &#8212; but not the rest of it.',
  "i'm keeping this list for whatever comes next. you'll hear it here first. &#10024;",
  "and the surprise i promised: the arcade's open. &#129323;",
]]);
if (!process.exitCode) console.log('\ncopy matches both functions ✓');
console.log(`\nwrote ${path.relative(process.cwd(), out)}/`);
