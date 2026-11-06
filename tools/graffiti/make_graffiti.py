"""Generate BANDRIP's graffiti kit with the spray simulator.

Run: python tools/graffiti/make_graffiti.py
Writes transparent WebP pieces to static/img/graffiti/ and composited walls
(CC0 Poly Haven brick/concrete + sprayed pieces) to static/img/walls/.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from spray import (blank, crop_alpha, dilate, drips, fbm, hexrgb, over, path_mask, place, shift, spray,  # noqa: E402
                   text_mask, to_image)

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / 'assets_src' / 'fonts'
CC0 = ROOT / 'assets_src' / 'cc0'
OUT = ROOT / 'static' / 'img' / 'graffiti'
WALLS = ROOT / 'static' / 'img' / 'walls'
SRC = ROOT / 'assets_src' / 'graffiti'
RED, INK, CHALK, BONE = '#E63228', '#151515', '#F2F0E9', '#E4DCCB'


def pad(mask, p):
    return np.pad(mask, p)


def save(img, name, quality=88):
    OUT.mkdir(parents=True, exist_ok=True)
    SRC.mkdir(parents=True, exist_ok=True)
    img.save(SRC / f'{name}.png')
    img.save(OUT / f'{name}.webp', quality=quality, method=6)
    print('wrote', name, img.size, flush=True)
    return img


def throwup(text, size=300, fill=RED, fill2='#FF6A52', line=INK, shine=CHALK, rot=-5, seed=1, extrude=9):
    M = pad(text_mask(text, FONTS / 'SedgwickAveDisplay-Regular.ttf', size, pad=40, stroke=int(size * 0.035)), 80)
    h, w = M.shape
    c = blank(h, w)
    # 3D block extrude, then outline, then fill, gradient, shine, drips
    ext = np.zeros_like(M)
    for k in range(1, extrude + 1):
        ext = np.maximum(ext, shift(M, k * 1.6, k * 1.6))
    ext = dilate(ext, size * 0.03)
    over(c, *spray(ext, line, edge=1.6, grain=0.18, overspray=7, halo=0.15, seed=seed))
    ol = dilate(M, size * 0.045)
    over(c, *spray(ol, line, edge=1.4, grain=0.12, overspray=6, halo=0.15, seed=seed + 1))
    over(c, *spray(M, fill, edge=1.8, grain=0.30, overspray=5, halo=0.1, seed=seed + 2))
    top = np.clip((np.linspace(1, -0.4, h)[:, None] * np.ones((1, w))), 0, 1).astype(np.float32)
    over(c, *spray(M * top, fill2, opacity=0.55, edge=6, grain=0.4, overspray=12, halo=0.05, seed=seed + 3))
    hi = np.clip(M - shift(M, 3.5, 3.5), 0, 1) * (top > 0.15)
    over(c, *spray(hi, shine, opacity=0.95, edge=0.9, grain=0.2, overspray=3, halo=0.05, seed=seed + 4))
    dr = drips(M, count=int(w / 70), max_len=size * 0.75, width=(size * 0.018, size * 0.034), seed=seed + 5)
    over(c, *spray(dr, fill, edge=1.0, grain=0.1, overspray=3, halo=0.05, seed=seed + 6))
    dr2 = drips(ol, count=int(w / 140), max_len=size * 0.5, width=(size * 0.014, size * 0.024), seed=seed + 7)
    over(c, *spray(dr2, line, edge=1.0, grain=0.1, overspray=3, halo=0.05, seed=seed + 8))
    img = to_image(c)
    return crop_alpha(img.rotate(rot, resample=Image.BICUBIC, expand=True), 10)


def tag(text, font='PermanentMarker-Regular.ttf', size=200, color=INK, rot=-8, seed=10, drip_n=6, stroke=0, tracking=0):
    M = pad(text_mask(text, FONTS / font, size, pad=30, stroke=stroke, tracking=tracking), 60)
    c = blank(*M.shape)
    over(c, *spray(M, color, edge=1.3, grain=0.22, overspray=6, halo=0.2, seed=seed))
    dr = drips(M, count=drip_n, max_len=size * 0.9, width=(size * 0.02, size * 0.04), seed=seed + 1)
    over(c, *spray(dr, color, edge=0.9, grain=0.1, overspray=3, halo=0.08, seed=seed + 2))
    return crop_alpha(to_image(c).rotate(rot, resample=Image.BICUBIC, expand=True))


def stencil_text(text, size=150, color=RED, rot=0, seed=20, tracking=0):
    M = pad(text_mask(text, FONTS / 'SairaStencilOne-Regular.ttf', size, pad=30, tracking=tracking), 70)
    c = blank(*M.shape)
    over(c, *spray(M, color, edge=1.0, grain=0.35, overspray=16, halo=0.35, speck=1.6, seed=seed))
    return crop_alpha(to_image(c).rotate(rot, resample=Image.BICUBIC, expand=True))


def stencil_logo(color=INK, size=900, seed=30):
    src = Image.open(ROOT / 'brand_supplied' / 'logo-skull-reference.jpg').convert('L')
    src = src.resize((size, size), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2.2))
    M = (np.asarray(src, np.float32) < 110).astype(np.float32)
    M = pad(np.asarray(Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255, 60)
    c = blank(*M.shape)
    over(c, *spray(M, color, edge=1.0, grain=0.3, overspray=14, halo=0.3, speck=1.4, seed=seed))
    return crop_alpha(to_image(c))


def doodle(paths, size, color, width, seed, drip_n=3):
    w, h = size
    M = path_mask(h, w, paths, width)
    c = blank(h, w)
    over(c, *spray(M, color, edge=width * 0.18, grain=0.25, overspray=width * 0.5, halo=0.25, seed=seed))
    dr = drips(M, count=drip_n, max_len=h * 0.35, width=(width * 0.35, width * 0.6), seed=seed + 1)
    over(c, *spray(dr, color, edge=1.0, grain=0.1, overspray=3, halo=0.05, seed=seed + 2))
    return crop_alpha(to_image(c))


def sticker_round(text='BANDRIP', d=520, bg=RED, fg=INK, seed=40):
    img = Image.new('RGBA', (d + 40, d + 40), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.ellipse([24, 28, d + 24, d + 32], fill=(0, 0, 0, 70))                       # shadow
    dr.ellipse([20, 20, d + 20, d + 20], fill=(242, 240, 233, 255))                # die-cut white border
    dr.ellipse([38, 38, d + 2, d + 2], fill=tuple(int(v * 255) for v in hexrgb(bg)) + (255,))
    f = ImageFont.truetype(str(FONTS / 'Anton-Regular.ttf'), int(d * 0.24))
    tb = dr.textbbox((0, 0), text, font=f)
    dr.text(((d + 40 - (tb[2] - tb[0])) / 2 - tb[0], (d + 40 - (tb[3] - tb[1])) / 2 - tb[1]), text, font=f, fill=tuple(int(v * 255) for v in hexrgb(fg)) + (255,))
    m = ImageFont.truetype(str(FONTS / 'SpaceMono-Bold.ttf'), int(d * 0.055))
    for s, y in (('STREET // UNIFORM', 0.26), ('DROP_01 · STUDIO', 0.70)):
        tb = dr.textbbox((0, 0), s, font=m)
        dr.text(((d + 40 - (tb[2] - tb[0])) / 2, (d + 40) * y), s, font=m, fill=(21, 21, 21, 255))
    return wear(img, seed)


def sticker_rect(lines, w=640, h=300, bg=CHALK, fg=INK, seed=41):
    img = Image.new('RGBA', (w + 30, h + 30), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rectangle([18, 20, w + 18, h + 20], fill=(0, 0, 0, 70))
    dr.rectangle([12, 12, w + 12, h + 12], fill=tuple(int(v * 255) for v in hexrgb(bg)) + (255,))
    dr.rectangle([12, 12, w + 12, 70], fill=(230, 50, 40, 255))
    m = ImageFont.truetype(str(FONTS / 'SpaceMono-Bold.ttf'), 30)
    dr.text((30, 26), lines[0], font=m, fill=(242, 240, 233, 255))
    f = ImageFont.truetype(str(FONTS / 'PermanentMarker-Regular.ttf'), 92)
    dr.text((34, 100), lines[1], font=f, fill=tuple(int(v * 255) for v in hexrgb(fg)) + (255,))
    return wear(img, seed)


def wear(img, seed):
    """Scuffs and slight fade so stickers look slapped on the street."""
    a = np.asarray(img, np.float32) / 255
    h, w = a.shape[:2]
    n = fbm(h, w, 40, 4, seed)
    scuff = (n > 0.72).astype(np.float32) * 0.35
    a[..., :3] = a[..., :3] * (1 - scuff[..., None]) + 0.85 * scuff[..., None]
    a[..., :3] *= (0.94 + 0.06 * fbm(h, w, 8, 2, seed + 1))[..., None]
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA')


def tape(w=620, h=110, seed=50):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.float32)
    a[..., :3] = hexrgb('#E9DCC0')
    a[..., 3] = 0.82 + 0.08 * fbm(h, w, 20, 3, seed)
    fibers = fbm(h, w, 3, 2, seed + 1)
    a[..., :3] *= (0.95 + 0.05 * fibers)[..., None]
    for side in (0, 1):   # torn ends
        for y in range(h):
            cut = int(abs(rng.normal(0, 7)) + 4 + 6 * np.sin(y * 0.4 + side))
            if side == 0:
                a[y, :cut, 3] = 0
            else:
                a[y, w - cut:, 3] = 0
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA')


def wall(base_jpg, size, tone=1.0, sat=1.0, dark=0.0, pieces=(), seed=60):
    """Tile a CC0 texture, then spray pieces onto it with a final grime pass."""
    W, H = size
    tex = Image.open(base_jpg).convert('RGB')
    tile = Image.new('RGB', (W, H))
    for x in range(0, W, tex.width):
        for y in range(0, H, tex.height):
            tile.paste(tex, (x, y))
    tile = ImageEnhance.Color(tile).enhance(sat)
    tile = ImageEnhance.Brightness(tile).enhance(tone)
    a = np.asarray(tile, np.float32) / 255
    if dark:
        a *= 1 - dark
    canvas = np.concatenate([a, np.ones((H, W, 1), np.float32)], -1)
    for img, (x, y), scale, opacity in pieces:
        im = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        arr = np.asarray(im, np.float32) / 255
        # paint picks up the wall's texture: modulate by local luminance of the wall
        place(canvas, arr[..., :3], arr[..., 3] * opacity, x, y)
    grime = fbm(H, W, 220, 4, seed)
    canvas[..., :3] *= (0.86 + 0.18 * grime)[..., None]
    base_lum = (a.mean(-1, keepdims=True) / max(a.mean(), 1e-3))
    canvas[..., :3] *= np.clip(0.82 + 0.18 * base_lum, 0.6, 1.15)
    return Image.fromarray((np.clip(canvas[..., :3], 0, 1) * 255).astype(np.uint8), 'RGB')


def main():
    piece = save(throwup('BANDRIP', 300), 'piece_bandrip')
    piece_chalk = save(throwup('BANDRIP', 220, fill=CHALK, fill2='#FFFFFF', line=INK, shine=RED, rot=4, seed=3), 'piece_bandrip_chalk')
    rip = save(tag('RIP', size=240, color=INK, rot=-10, seed=11), 'tag_rip')
    rip_red = save(tag('R.I.P', size=180, color=RED, rot=6, seed=12), 'tag_rip_red')
    drop = save(tag('DROP_01', size=150, color=RED, rot=-6, seed=13), 'tag_drop')
    street = save(tag('street uniform', font='SedgwickAveDisplay-Regular.ttf', size=150, color=CHALK, rot=-4, seed=14, drip_n=9), 'tag_street_chalk')
    street_ink = save(tag('street uniform', font='SedgwickAveDisplay-Regular.ttf', size=150, color=INK, rot=-4, seed=15, drip_n=9), 'tag_street_ink')
    wear_loud = save(stencil_text('WEAR IT LOUD', 130, RED, rot=-2, seed=21, tracking=8), 'stencil_wear_loud')
    studio = save(stencil_text('STUDIO OPEN', 110, CHALK, rot=1, seed=22, tracking=6), 'stencil_studio_open')
    no_rules = save(stencil_text('NO DRESS CODE', 100, INK, rot=-1, seed=23, tracking=6), 'stencil_no_dress_code')
    skull = save(stencil_logo(INK, 900, 30), 'stencil_skull')
    skull_red = save(stencil_logo(RED, 900, 31), 'stencil_skull_red')
    arrow = save(doodle([[(40, 220), (300, 120), (560, 150)], [(470, 80), (560, 150), (480, 230)]], (620, 300), RED, 26, 70), 'doodle_arrow')
    xmark = save(doodle([[(50, 50), (300, 300)], [(300, 40), (50, 310)]], (360, 360), RED, 34, 71), 'doodle_x')
    crown = save(doodle([[(40, 220), (70, 70), (150, 170), (230, 40), (310, 170), (390, 70), (420, 220), (40, 220)]], (460, 280), INK, 20, 72), 'doodle_crown')
    circle_pts = [(330 + 290 * np.cos(t) * (1 + 0.05 * np.sin(3 * t)), 200 + 150 * np.sin(t)) for t in np.linspace(0.3, 2 * np.pi + 0.9, 60)]
    circle = save(doodle([circle_pts], (680, 420), RED, 18, 73, 2), 'doodle_circle')
    under = save(doodle([[(30, 70), (300, 45), (620, 60), (900, 30)]], (940, 140), RED, 22, 74, 4), 'doodle_underline')
    star = save(doodle([[(150, 20), (190, 120), (290, 120), (210, 185), (245, 290), (150, 225), (55, 290), (90, 185), (10, 120), (110, 120), (150, 20)]], (310, 310), CHALK, 14, 75, 2), 'doodle_star')
    save(sticker_round(), 'sticker_round', 92)
    save(sticker_rect(['BANDRIP // STUDIO', 'open casting']), 'sticker_casting', 92)
    save(sticker_rect(['HELLO, WE ARE', 'BANDRIP'], bg='#F2F0E9'), 'sticker_hello', 92)
    save(tape(), 'tape', 90)

    WALLS.mkdir(parents=True, exist_ok=True)
    brick = CC0 / 'red_brick_03_diff_1k.jpg'
    conc = CC0 / 'concrete_wall_003_diff_1k.jpg'
    # gate / runway / depot back wall: brick covered in pieces
    w1 = wall(brick, (2048, 1024), tone=0.62, sat=0.65, pieces=[
        (piece, (240, 250), 0.78, 1.0), (skull, (1540, 120), 0.42, 0.9), (rip_red, (1300, 640), 0.9, 1.0),
        (street, (120, 70), 0.9, 0.95), (arrow, (1660, 700), 0.6, 1.0), (crown, (980, 120), 0.55, 0.95),
        (wear_loud, (80, 840), 0.85, 0.9), (xmark, (1880, 520), 0.4, 1.0), (studio, (1150, 900), 0.8, 0.85),
    ], seed=61)
    w1.save(WALLS / 'brick_graffiti.webp', quality=82, method=6)
    w1.save(SRC / 'brick_graffiti.png')
    w2 = wall(brick, (2048, 1024), tone=0.3, sat=0.5, pieces=[
        (skull_red, (790, 160), 0.62, 0.95), (street, (90, 760), 0.8, 0.7), (rip_red, (1500, 130), 0.8, 0.8),
        (studio, (1360, 860), 0.9, 0.8), (xmark, (300, 200), 0.35, 0.9),
    ], seed=62)
    w2.save(WALLS / 'brick_dark.webp', quality=80, method=6)
    w3 = wall(conc, (2048, 1024), tone=1.18, sat=0.25, pieces=[
        (wear_loud, (1180, 120), 0.9, 0.55), (crown, (220, 640), 0.5, 0.45), (skull, (1600, 520), 0.32, 0.4),
        (drop, (420, 140), 0.8, 0.5), (under, (900, 860), 0.7, 0.45), (no_rules, (120, 900), 0.8, 0.5),
    ], seed=63)
    w3.save(WALLS / 'concrete_tagged.webp', quality=80, method=6)
    w4 = wall(conc, (2048, 1024), tone=0.42, sat=0.2, pieces=[
        (piece_chalk, (520, 260), 0.75, 0.9), (rip, (1600, 120), 0.6, 0.6), (star, (180, 160), 0.6, 0.9),
        (circle, (1400, 620), 0.6, 0.8), (studio, (160, 860), 0.8, 0.8),
    ], seed=64)
    w4.save(WALLS / 'concrete_dark_tagged.webp', quality=80, method=6)
    print('walls written', flush=True)


if __name__ == '__main__':
    main()
