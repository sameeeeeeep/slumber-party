# nailinit Diwali Party — invite spec (v5)

Goal: one personalised, tactile, theatrical moment. Every surface is an object from the deck (paper, foil, wax, wood, glass, enamel), lit by real (fake) light, and everything you do becomes something you can share or pin to the mohalla wall.

## 0. Personalisation
- `?name=Riya Sharma` → full name is the tracking key; first name ("Riya") is what's shown.
- Shown on: envelope label (gold foil), reveal line, headline, game headers ("riya ki kismat", "riya’s ring toss", "riya’s 2027 mood draw"), haul, share images, wall entries (first name + initial).
- Later: guest insta handle + DP on wall cards (needs a guest list with handles).

## 1. Opening — dark → match light → lights on
- Dark from the first frame; the match flame is the light.
- Steps: open · strike · light. "stuck? do it for me" autoplays.
- Matchbox sits bottom-left, by the corner that burns (burn origin = bottom-left).
- Burn takes 5.6s so people can watch it; paper edge is the light source.
- Reveal: kandils glow, confetti, bells.

## 2. Materials
| surface | treatment |
|---|---|
| envelope name | gold foil, embossed, moving glint |
| wax seal | glossy, specular follows the flame |
| invite card | **foil-printed**: yellow paper = brushed gold foil, DIWALI = holographic foil, black type = glossy ink; light follows the card's tilt |
| detail signs (kab / kaha / outfit) | **metal enamel**: gold-leaf rim, light sweep, chrome lettering, gold kicker |
| tickets | paper grain + sheen |

## 3. Sound
Real foley (ElevenLabs via Magnific), `assets/sfx/<name><n>.mp3`, random take + slight pitch per play; synth fallback until loaded.
Only the open stall makes noise; leaving a stall stops its loops and cancels its sequence.

## 4. Order of the page
envelope → invite → details (3 signs) → RSVP → **mohalle ki deewar** (before games, for FOMO) → game center → your haul → footer.

## 5. Mohalle ki deewar (the wall)
- One row, all games remixed randomly, drifts forever, drag to scrub. Pauses off-screen; loads only when near the screen.
- Each card carries its illustration: kismat poster / the balloons you popped / the ringed bottle / the mood ticket.
- Source: Google Form (`event=wall`) → published CSV, refresh 60s. Pins before launch (`WALL_FROM`) are hidden.
- Until 8 real pins exist, generic sample cards (incl. a couple of roasts) fill the row.

## 6. Game center — guided, one by one
Order: tota → gubbara → ring toss → lucky draw → haul. Each result: **pin** + **share** + "next stall →". Finished stalls get ✓. The haul lists every result for pinning/sharing later.
A label sits right above every result: "your kismat for 2027", "what your pellets won", "what your rings won", "your mood in the coming year".

| game | rules | outcomes |
|---|---|---|
| tota jyotish | tap the deck (or button) → shuffle → parrot picks | 90 cards: 50 hopeful + 36 roast twins on the same art (e.g. *kuch naya seekhoge* / *kuch nahi seekhoge*), 2 readings each, no repeat card per visit |
| gubbara phod | 15 balloons, 10 pellets, **win up to 4** | 44 prizes, nice + roasty |
| ring toss | 5 bottles (nothing written under them), 10 rings, **win up to 2**, coaching on every miss | 31 prizes, nice + roasty |
| lucky draw | drag the drum (any circle) or tap to shove; 3-step meter; drum steps aside for the ticket | first-person mood ("i’m my own good luck charm") × lucky colour × snack × month — 80 moods (incl. roasts) → ~190k tickets |

## 7. Share
Story image (1080×1920) per result with name; native share on phones, download + caption on desktop.

## 8. Speed
- Opening assets preloaded; everything below the opening lazy-loads; wall + kismat posters load on demand.
- CSS/JS cache-busted per deploy (`?v=`).
- Cloudflare (needs dashboard/API access): cache rule for `/diwali/assets/*` (edge 30d, browser 1d) + purge on deploy; tiered cache on.
