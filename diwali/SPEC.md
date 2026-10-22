# nailinit Diwali Party — invite spec (v4)

Goal: one personalised, tactile, theatrical moment. Every surface is an object from the deck (paper, foil, wax, wood, glass), lit by real (fake) light, and everything you do becomes something you can share or pin to the mohalla wall.

## 0. Personalisation (everywhere)
- `?name=Riya Sharma` → full name is the tracking key; first name ("Riya") is what's shown.
- Shown on: envelope label (foil), reveal line, headline ("riya, dress loud."), RSVP card, game headers ("riya ki kismat"), every result card, share image ("riya’s kismat"), wall entries.

## 1. Opening — dark → match light → lights on
- Page loads in **night**: room is dark from the first frame (not after opening). Only a faint moonlit outline of the envelope, kandils as dark silhouettes.
- Steps: **open · strike · light** (no "read").
- Matchbox is lit by a soft ambient spill only; once struck, the **flame is the light source**: warm radial light that follows the flame, flickers in sync with it, falls off with distance, and lights the envelope/box/kandils that are near it (brightness + warm tint driven by distance).
- Burn: paper edge is the light source; room warms as it burns.
- Reveal: lights come on — kandils glow one by one, marigolds brighten, warm ambient fades in.

## 2. Materials
- **Name** (envelope label, reveal, headline): gold-foil type — metallic gradient fill, embossed shadow, moving glint.
- **Wax seal**: glossy red with specular highlight that moves with the light, slight emboss.
- **Matchbox**: paper grain + printed-ink feel, worn edges; striker strip rough; lit by the flame.
- **Invite card / tickets**: paper grain + moving sheen.
- **Flame**: layered (blue base, white-yellow core, orange body, red tips), turbulent tip flicker, heat shimmer, ember sparks, smoke wisp, matching light flicker.

## 3. Mohalla game center
Each game ends in a **result card** with a **score** where it makes sense:
| game | result | score |
|---|---|---|
| tota jyotish | kismat card (poster + title) + reading | — |
| gubbara phod | cards for each popped balloon | n/5 popped |
| chhalla | prize card | n/3 ringed |
| lucky draw | ticket with new-year personality | — |

Every result card has two actions: **share** (story image with name) and **pin to the wall**.

## 4. Mohalla ki deewar (the wall)
- A shared, live wall of everyone's results: moving tickers of cards (two rows, opposite directions), plus a **top scores** strip (gubbara + chhalla).
- Entries: name (first name + initial), game, result, score, time. No free text → nothing to moderate.
- Storage: posts go to the existing Google Form (event = `wall`); a **published-to-web** CSV of the sheet feeds the wall (read-only, public). Refresh every 60s.

## 5. Share
- Story-sized image (1080×1920) for invite + every result, with the guest's first name, their result, and the link.
- Native share sheet on phones (Instagram / WhatsApp), download + caption copied on desktop.

## 6. Order of build
1. Dark-first opening + flame as light + steps.
2. Flame rebuild.
3. Materials (foil name, seal, matchbox, card sheen).
4. Personalisation pass.
5. Scores + "pin to wall" + wall ticker (Google Sheet publish).
6. Share images with names.
7. Full phone + desktop QA, then deploy.
