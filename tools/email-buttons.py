# Draws the teaser email's button and "+12 NEW MESSAGES" pill as PNGs (2x),
# so Gmail's dark mode can't recolour their text.
#
#   python3 tools/email-buttons.py <dir with PressStart2P-Regular.ttf> assets/email
#
# (the font is OFL, from github.com/google/fonts/tree/main/ofl/pressstart2p)
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
FONTS, OUT = sys.argv[1], sys.argv[2]
PIXEL = f'{FONTS}/PressStart2P-Regular.ttf'
S = 2  # retina

def glow_layer(size, box, radius, color, blur):
    g = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle(box, radius, fill=color)
    return g.filter(ImageFilter.GaussianBlur(blur))

def gradient(size, a, b):
    w, h = size
    g = Image.new('RGBA', size)
    px = g.load()
    for x in range(w):
        t = x / max(1, w - 1)
        c = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
        for y in range(h): px[x, y] = c
    return g

def text_center(img, box, text, font, fill, arrow=False):
    d = ImageDraw.Draw(img)
    tw = d.textlength(text, font=font)
    aw = (font.size * 0.75 + font.size * 0.6) if arrow else 0
    x0 = box[0] + (box[2] - box[0] - tw - aw) / 2
    asc, desc = font.getmetrics()
    y0 = box[1] + (box[3] - box[1] - font.size) / 2
    d.text((x0, y0), text, font=font, fill=fill)
    if arrow:  # ▸ drawn, not typed: the pixel font has no such glyph
        ax = x0 + tw + font.size * 0.6; s = font.size * 0.75; cy = y0 + font.size / 2
        d.polygon([(ax, cy - s / 2), (ax + s * 0.8, cy), (ax, cy + s / 2)], fill=fill)

# ---- the button: 392 x 72, pink→orange, white pixel text, soft glow
W, H, PAD = 392 * S, 72 * S, 18 * S
img = Image.new('RGBA', (W + PAD * 2, H + PAD * 2), (0, 0, 0, 0))
img.alpha_composite(glow_layer(img.size, (PAD, PAD + 8 * S, PAD + W, PAD + H + 8 * S), H // 2, (235, 100, 140, 120), 12 * S))
mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), H // 2, fill=255)
img.paste(gradient((W, H), (235, 100, 140), (236, 100, 42)), (PAD, PAD), mask)
text_center(img, (PAD, PAD, PAD + W, PAD + H), 'OPEN THE CHAT', ImageFont.truetype(PIXEL, 15 * S), (255, 255, 255, 255), arrow=True)
img.save(f'{OUT}/cta.png', optimize=True)

# ---- the pill: dark, pink border, cream pixel text, pink glow
font = ImageFont.truetype(PIXEL, 11 * S)
label = '+12 NEW MESSAGES'
tw = ImageDraw.Draw(img).textlength(label, font=font)
W, H, PAD = int(tw + 44 * S), 36 * S, 16 * S
img = Image.new('RGBA', (W + PAD * 2, H + PAD * 2), (0, 0, 0, 0))
img.alpha_composite(glow_layer(img.size, (PAD, PAD, PAD + W, PAD + H), H // 2, (235, 100, 140, 110), 10 * S))
d = ImageDraw.Draw(img)
d.rounded_rectangle((PAD, PAD, PAD + W - 1, PAD + H - 1), H // 2, fill=(36, 24, 33, 255), outline=(235, 100, 140, 255), width=3)
text_center(img, (PAD, PAD, PAD + W, PAD + H), label, font, (255, 246, 248, 255))
img.save(f'{OUT}/pill.png', optimize=True)
print('cta', Image.open(f'{OUT}/cta.png').size, 'pill', Image.open(f'{OUT}/pill.png').size)
