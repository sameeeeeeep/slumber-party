"""
Build the teaser email's pictures: the blurred "rest of the chat" and the avatar.

    python3 tools/blur-leaks.py [--fonts DIR]

The picture is the Email1 mockup's blurred block, pixel for pixel, at 2x:
five shapes (bubble, photo, bubble, bubble, photo) blurred and dimmed the way
the mockup's `filter: blur(5px); opacity: .85` does it, and the "+N NEW
MESSAGES" pill drawn crisp on top, centred, glow and all. The pill lives in
the picture because email can't lay text over an image, and splitting the
image around a real-text pill leaves a seam on the bubble under it.

It spans the card's full 420px (shapes start 14px in, where the real bubbles
start) so the blur can spill into the margin like the mockup's does, and its
background is the flat #2a1520 the card is in that zone (thread-email.ts keeps
the gradient flat there), so there is no box edge in any client.

Photos: drop the real leaked pictures in assets/email/leaks/ (the first two by
name are used, cropped to fit and blurred hard, because the reveal is the
site's job). Without them the mockup's placeholder gradients stand in.

Fonts: Press Start 2P for the pill. Pass --fonts DIR holding
PressStart2P-Regular.ttf, or put it in tools/fonts/. (From Google Fonts:
raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/)

Writes assets/email/chat-preview.png (840x980, 2x) and
assets/email/khushi-avatar.png (96x96). The N in the pill is PREVIEW_COUNT
from thread-email.ts, read here so the two can't drift.
"""
import argparse
import pathlib
import re
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/email/chat-preview.png'   # PNG: the background must match the card exactly
LEAKS = ROOT / 'assets/email/leaks'

ap = argparse.ArgumentParser()
ap.add_argument('--fonts', type=pathlib.Path, default=ROOT / 'tools/fonts')
args = ap.parse_args()
PILL_FONT = args.fonts / 'PressStart2P-Regular.ttf'
if not PILL_FONT.exists():
    sys.exit(f'need {PILL_FONT} (see the docstring)')

ts = (ROOT / 'supabase/functions/_shared/thread-email.ts').read_text()
COUNT = int(re.search(r'PREVIEW_COUNT = (\d+)', ts).group(1))

# ---- the mockup's numbers, in 1x CSS px --------------------------------------
X2 = 2                       # rendered at 2x so the pill text is sharp on phones
CARD_W, PAD = 420, 14        # card width; the thread's side padding
CONTENT_W = CARD_W - 2 * PAD
GAP, MARGIN = 8, 10          # between shapes; above and below the block
BG = (0x2a, 0x15, 0x20)      # the card where the picture sits
CREAM = (0xff, 0xf6, 0xf8)
BLUR, DIM = 5, 0.85          # filter: blur(5px); opacity: .85
RADIUS = 18
# (kind, width, height): bubbles as a share of the content width, photos in px
SHAPES = [('bubble', .70, 38), ('photo', 240, 150), ('bubble', .82, 62),
          ('bubble', .58, 38), ('photo', 240, 150)]
PHOTO_TINTS = [((0xf6, 0xdf, 0xe5), (0xe8, 0xe6, 0xef), (0xfb, 0xe2, 0xcf)),
               ((0xc9, 0xb3, 0xbd), (0xb9, 0xa7, 0xc9), (0xd8, 0xb8, 0x9e))]
PILL = dict(font=10, pad=(18, 8), border=1.5, bg=(0x24, 0x18, 0x21), fg=CREAM,
            ring=(0xeb, 0x64, 0x8c), spacing=.06, glow=24, glow_alpha=.45)

block_h = sum(h for _, _, h in SHAPES) + GAP * (len(SHAPES) - 1)
W, H = CARD_W * X2, (block_h + 2 * MARGIN) * X2
px = lambda v: round(v * X2)


def gradient_135(size, stops):
    """CSS linear-gradient(135deg, a, b 50%, c): top-left to bottom-right."""
    w, h = size
    im = Image.new('RGB', size)
    pix = im.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            a, b = (stops[0], stops[1]) if t < .5 else (stops[1], stops[2])
            f = t * 2 if t < .5 else (t - .5) * 2
            pix[x, y] = tuple(round(a[i] + (b[i] - a[i]) * f) for i in range(3))
    return im


def leak_photo(path, size):
    """A real leaked picture: cropped to cover, then blurred past recognition."""
    im = Image.open(path).convert('RGB')
    w, h = size
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((l, t, l + w, t + h)).filter(ImageFilter.GaussianBlur(14 * X2))


photos = sorted(p for p in LEAKS.glob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'))[:2]
if len(photos) < 2:
    print(f'{len(photos)} real photo(s) in {LEAKS.relative_to(ROOT)}; the mockup tints stand in for the rest', file=sys.stderr)

# ---- the shapes, blurred and dimmed like the mockup's block -------------------
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
y, photo_i = MARGIN, 0
for kind, w, h in SHAPES:
    w = w * CONTENT_W if kind == 'bubble' else w
    box = (px(PAD), px(y), px(PAD + w), px(y + h))
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, px(RADIUS), fill=255)
    if kind == 'bubble':
        fill = Image.new('RGBA', (W, H), CREAM + (255,))
    else:
        size = (box[2] - box[0], box[3] - box[1])
        pic = leak_photo(photos[photo_i], size) if photo_i < len(photos) else gradient_135(size, PHOTO_TINTS[photo_i])
        fill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        fill.paste(pic, box[:2])
        photo_i += 1
    layer.paste(fill, (0, 0), mask)
    y += h + GAP
layer = layer.filter(ImageFilter.GaussianBlur(px(BLUR)))
a = layer.getchannel('A').point(lambda v: round(v * DIM))
layer.putalpha(a)

im = Image.new('RGBA', (W, H), BG + (255,))
im.alpha_composite(layer)

# ---- the pill, crisp, centred on the block --------------------------------------
text = f'+{COUNT} NEW MESSAGES'
font = ImageFont.truetype(str(PILL_FONT), px(PILL['font']))
spacing = px(PILL['font'] * PILL['spacing'])
text_w = sum(font.getlength(c) for c in text) + spacing * (len(text) - 1)
text_h = px(PILL['font'])                    # Press Start 2P sits on a square em
pw, ph = round(text_w + 2 * px(PILL['pad'][0])), round(text_h + 2 * px(PILL['pad'][1]))
cx, cy = W // 2, px(MARGIN + block_h / 2)
pbox = (cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2)

glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).rounded_rectangle(pbox, ph // 2, fill=PILL['ring'] + (round(255 * PILL['glow_alpha']),))
glow = glow.filter(ImageFilter.GaussianBlur(px(PILL['glow']) / 2))
im.alpha_composite(glow)

d = ImageDraw.Draw(im)
d.rounded_rectangle(pbox, ph // 2, fill=PILL['bg'] + (255,), outline=PILL['ring'] + (255,), width=px(PILL['border']))
x = pbox[0] + px(PILL['pad'][0])
ty = cy - text_h // 2
for c in text:
    d.text((x, ty), c, font=font, fill=PILL['fg'] + (255,))
    x += font.getlength(c) + spacing

im.convert('RGB').save(OUT, 'PNG', optimize=True)
print(f'wrote {OUT.relative_to(ROOT)} {W}x{H} ({OUT.stat().st_size // 1024}KB); pill {pw // X2}x{ph // X2}px')

av = Image.open(ROOT / 'assets/khushi-face.png').convert('RGBA').resize((96, 96), Image.LANCZOS)
av.save(ROOT / 'assets/email/khushi-avatar.png', optimize=True)
print(f"wrote assets/email/khushi-avatar.png ({(ROOT / 'assets/email/khushi-avatar.png').stat().st_size // 1024}KB)")
