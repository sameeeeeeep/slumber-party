#!/usr/bin/env node
/* ============================================================================
   Draws besties/photos/somewhere.jpg — the stand-in behind "not telling you
   where". It has to read as a real photograph rather than clip art, and it has
   to show nothing, because the caption makes a promise the frame must keep:
   a car window at night, thrown far out of focus, flash catching the glass.

   Written per-pixel and encoded to PNG by hand (zlib is in Node; a canvas is
   not), then handed to sips for the JPEG. Delete this the moment there are
   real pictures — it exists so the conversation isn't fifteen messages of
   unbroken text.

   Usage:  node tools/make-placeholder-photo.mjs
   ============================================================================ */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const W = 900, H = 936;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* deterministic noise, so re-running gives the same grain rather than a diff */
let seed = 20260818;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// [x, y, radius, r, g, b, strength] — light smeared across the glass
const GLOWS = [
  [640, 250, 300, 255, 196, 120, .36],
  [250, 430, 260, 120, 220, 220, .20],
  [760, 640, 230, 255, 150,  90, .22],
  [120, 120, 200, 235, 140, 170, .18],
];
// out-of-focus discs: bright to the rim, then a cliff — that edge is what says "lens"
const BOKEH = [
  [700, 190, 74, 255, 214, 150, .50], [790, 300, 52, 255, 196, 120, .40],
  [604, 300, 40, 255, 230, 180, .34], [300, 520, 62, 150, 230, 225, .26],
  [190, 380, 44, 180, 240, 235, .22], [820, 700, 58, 255, 170, 110, .30],
  [430, 200, 30, 255, 240, 210, .26], [520, 760, 46, 255, 160, 190, .20],
  [110, 640, 38, 200, 220, 255, .16], [660, 470, 26, 255, 235, 200, .24],
  [355, 300, 22, 255, 225, 190, .18], [745, 415, 34, 190, 235, 230, .16],
];

const px = Buffer.alloc(W * H * 3);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // night, teal falling to near-black on the diagonal
    const t = Math.min(1, (x * .3 + y) / (W * .3 + H));
    let r, g, b;
    if (t < .55) { const k = t / .55; r = 22 + (13 - 22) * k; g = 50 + (30 - 50) * k; b = 61 + (40 - 61) * k; }
    else { const k = (t - .55) / .45; r = 13 + (6 - 13) * k; g = 30 + (13 - 30) * k; b = 40 + (18 - 40) * k; }

    for (const [gx, gy, rad, gr, gg, gb, s] of GLOWS) {
      const d = Math.hypot(x - gx, y - gy);
      if (d < rad) { const f = (1 - d / rad) ** 2 * s; r += (gr - r) * f; g += (gg - g) * f; b += (gb - b) * f; }
    }

    for (const [bx, by, rad, br, bg, bb, s] of BOKEH) {
      const d = Math.hypot(x - bx, y - by);
      if (d < rad) {
        const f = (1 - smooth(rad * .72, rad, d)) * s;
        r += (br - r) * f; g += (bg - g) * f; b += (bb - b) * f;
      }
    }

    // the blurred dark mass of a seat back, bottom-left, and a door frame at the right
    const seat = 1 - smooth(0, 150, Math.max(0, (y - (700 - (x / 400) * 104)) * -1 + 150) - 150 + (y - 640) * .0);
    const seatMask = smooth(660, 800, y) * (1 - smooth(320, 520, x));
    const frameMask = smooth(0, 1, 1 - Math.min(1, Math.hypot((x - (W + 40)) / 230, (y - 130) / 300)));
    const dark = Math.min(.92, seatMask * .92 + frameMask * .9);
    if (dark > 0) { r += (3 - r) * dark; g += (8 - g) * dark; b += (12 - b) * dark; }

    // the flash blowing out one corner of the glass
    const fd = Math.hypot(x - 300, y - 190);
    if (fd < 460) { const f = (1 - fd / 460) ** 1.8 * .34; r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }

    // vignette
    const vd = Math.hypot((x - W / 2) / (H * .78), (y - H / 2) / (H * .78)) * (H * .78);
    const v = smooth(H * .28, H * .78, vd) * .62;
    r *= (1 - v); g *= (1 - v); b *= (1 - v);

    // grain — a 400-speed disposable, in the dark
    const n = (rnd() - .5) * 34;
    const i = (y * W + x) * 3;
    px[i] = clamp(r + n); px[i + 1] = clamp(g + n); px[i + 2] = clamp(b + n);
  }
}

/* ---- minimal PNG encoder (truecolour, no filtering) ---- */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;                                   // filter: none
  px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(ROOT, 'besties/photos/_somewhere.png');
writeFileSync(out, png);
console.log(`wrote ${out}  (${Math.round(png.length / 1024)}KB)`);
console.log('now:  sips -s format jpeg -s formatOptions 72 besties/photos/_somewhere.png --out besties/photos/somewhere.jpg');
