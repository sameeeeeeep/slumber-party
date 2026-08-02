# Khushi's Secret Slumber Party

An invite-only landing page — a retro pink computer boots up an 8-bit glitch
broadcast, zooms into the screen, and lands in a step-by-step application.

Pure static site: `index.html` + one image. Fonts load from Google Fonts.
No build step. Deployed with GitHub Pages.

---

## `/besties` — the private invitation

`secretslumberparty.com/besties` is the hidden layer for guests who are already
invited. Password screen → the lock opens → a camera flash → Khushi starts
texting you. The dates, the location and the packing list arrive as messages;
it ends on a hold-to-pinky-promise and a collectible invite card.

**Password: `PINKYPROMISE`** (typed in any case).

### Why the content is encrypted

The site is static, so there is no server to check a password against. The naive
version — `if (typed === 'PINKYPROMISE')` — would put both the password and the
whole invitation in view-source, which defeats the point of a private route.

So the password *is* the key. `besties/sealed.js` is AES-GCM ciphertext under a
PBKDF2-SHA256 key (250k rounds) derived from the password. Before someone types
the right words their browser is holding noise, and a wrong password doesn't get
"rejected" — it simply produces no plaintext, so there is no comparison to skip.

This is not bank security: anyone with the password can pass it on, and the
ciphertext can be attacked offline. It is the right amount of security for a
party invitation, and it is strictly better than a string comparison.

### Editing the invitation

Everything Khushi says — dates, location teaser, packing list, invite copy,
easter eggs — lives in `besties/content.json`. That file is **gitignored**: it's
the plaintext the sealed payload exists to protect.

```bash
node tools/besties-seal.mjs seal      # content.json → sealed.js
node tools/besties-seal.mjs unseal    # sealed.js → content.json (needs the password)
```

Lost `content.json`? `unseal` rebuilds it. Changing the password:

```bash
node tools/besties-seal.mjs seal --pass=NEWWORD
node tools/besties-seal.mjs guests --pass=NEWWORD   # so personal links keep working
```

### Personalised links

```bash
node tools/besties-seal.mjs add "Shanaya Kapoor"
#  ↳ send her:  secretslumberparty.com/besties/shanaya-k7m2
```

She skips the password entirely — the link is her key — and is greeted with
"WAIT… IS THAT SHANAYA? 👀" before going in. Each guest gets their own sealed
blob keyed to her own code, so `besties/guests.js` never exposes the guest list:
there is no readable name in it, and the lookup index is derived over 100k
PBKDF2 rounds so the codes can't be cheaply guessed against a list of first
names. `/besties/<name>` resolves through `404.html`, which is how a static host
does pretty URLs.

`besties/guests.json` (the plaintext roster) is gitignored too — keep it, or
re-mint links after a fresh clone.

### What it deliberately doesn't do

No RSVP questionnaire. Tapping "I'M COMING" is one confirmation and nothing
else; names, numbers and dietary requirements come through the real group chat
afterwards. Nothing personal is written anywhere, and analytics carry only an
opaque 8-character `guest_ref`, never a name.

### Files

| | |
|---|---|
| `besties/index.html` | markup + all styling |
| `besties/besties.js` | the experience |
| `besties/sealed.js` | encrypted content (generated, committed) |
| `besties/guests.js` | encrypted guest records (generated, committed) |
| `besties/og.jpg` | the WhatsApp preview card |
| `tools/besties-seal.mjs` | seal / unseal / mint links |
| `404.html` | routes `/besties/<name>` on GitHub Pages |
