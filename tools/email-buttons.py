"""
Draw the teaser email's button as a PNG (2x), so Gmail's dark mode can't
recolour its text the way it did the live-text version (white on pink came
out dark on pink). Images it leaves alone.

    python3 tools/email-buttons.py [--fonts DIR]

The button is the mockup's: 392x64, pink to orange, white Press Start 2P
with a drawn ▸ (the font has no such glyph), soft glow. The picture is the
card's full 420px wide, with 18px of clear space above and below, so the
glow spills into the margins; thread-email.ts shows it at width 420 in a row
with no padding. The "+12 new messages" pill is drawn by blur-leaks.py, into
the preview picture it sits on.

Fonts: PressStart2P-Regular.ttf from --fonts DIR or tools/fonts/.
Writes assets/email/cta.png.
"""
import argparse
import pathlib
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/email/cta.png'

ap = argparse.ArgumentParser()
ap.add_argument('--fonts', type=pathlib.Path, default=ROOT / 'tools/fonts')
args = ap.parse_args()
PIXEL = args.fonts / 'PressStart2P-Regular.ttf'
if not PIXEL.exists():
    sys.exit(f'need {PIXEL} (see the docstring)')

S = 2                                     # retina
W, H = 392 * S, 64 * S                    # the button
PAD_X, PAD_Y = 14 * S, 18 * S             # clear space: the card's side margin; room for the glow
PINK, ORANGE = (235, 100, 140), (236, 100, 42)


def glow_layer(size, box, radius, color, blur):
    g = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle(box, radius, fill=color)
    return g.filter(ImageFilter.GaussianBlur(blur))


def gradient(size, a, b):
    """CSS linear-gradient(90deg, a, b)."""
    w, h = size
    g = Image.new('RGBA', size)
    px = g.load()
    for x in range(w):
        t = x / max(1, w - 1)
        c = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
        for y in range(h):
            px[x, y] = c
    return g


def text_center(img, box, text, font, fill, arrow=False):
    d = ImageDraw.Draw(img)
    tw = d.textlength(text, font=font)
    aw = (font.size * 0.75 + font.size * 0.6) if arrow else 0
    x0 = box[0] + (box[2] - box[0] - tw - aw) / 2
    y0 = box[1] + (box[3] - box[1] - font.size) / 2   # Press Start 2P sits on a square em
    d.text((x0, y0), text, font=font, fill=fill)
    if arrow:
        ax = x0 + tw + font.size * 0.6
        s, cy = font.size * 0.75, y0 + font.size / 2
        d.polygon([(ax, cy - s / 2), (ax + s * 0.8, cy), (ax, cy + s / 2)], fill=fill)


img = Image.new('RGBA', (W + 2 * PAD_X, H + 2 * PAD_Y), (0, 0, 0, 0))
box = (PAD_X, PAD_Y, PAD_X + W, PAD_Y + H)
# box-shadow: 0 6px 20px rgba(235,100,140,.45)
img.alpha_composite(glow_layer(img.size, (box[0], box[1] + 6 * S, box[2], box[3] + 6 * S), H // 2, PINK + (115,), 10 * S))
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), H // 2, fill=255)
img.paste(gradient((W, H), PINK, ORANGE), box[:2], mask)
text_center(img, box, 'OPEN THE CHAT', ImageFont.truetype(str(PIXEL), 14 * S), (255, 255, 255, 255), arrow=True)
img.save(OUT, optimize=True)
print(f'wrote {OUT.relative_to(ROOT)} {img.size[0]}x{img.size[1]} ({OUT.stat().st_size // 1024}KB)')
