"""Procedural textures for the mascot: tileable paisley bandana and the woven cap patch.

Run: python tools/mascot/textures.py
Writes PNGs to assets_src/mascot/ (for Blender) and WebP to static/img/tex/ (for the web).
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'mascot'
WEB = ROOT / 'static' / 'img' / 'tex'
RED = (230, 50, 40)
RED_DARK = (178, 30, 26)
CHALK = (242, 240, 233)
INK = (21, 21, 21)


def paisley_points(cx, cy, size, rot, curl=1.0, k=1.0):
    """Teardrop (round body, pointed tip curled to one side) as a polygon.

    k < 1 gives the concentric inner echoes used for the classic layered motif.
    """
    R = size * 0.30 * k
    tip = (0.0, size * 0.62 * (0.55 + 0.45 * k))
    a_r, a_l = math.radians(-15), math.radians(195)
    pts = []
    for i in range(0, 37):  # body arc over the top (y negative is up in image space)
        a = a_r - i * (2 * math.pi - (a_l - a_r)) / 36
        pts.append((R * math.cos(a), R * math.sin(a)))
    lx, ly = pts[-1]
    for i in range(1, 21):  # left flank to tip
        t = i / 20
        c1 = (lx - R * 0.15, ly + R * 1.1)
        pts.append(((1 - t) ** 2 * lx + 2 * (1 - t) * t * c1[0] + t * t * tip[0],
                    (1 - t) ** 2 * ly + 2 * (1 - t) * t * c1[1] + t * t * tip[1]))
    rx, ry = pts[0]
    for i in range(1, 20):  # tip back to right flank
        t = i / 20
        c2 = (rx + R * 0.05, ry + R * 0.9)
        pts.append(((1 - t) ** 2 * tip[0] + 2 * (1 - t) * t * c2[0] + t * t * rx,
                    (1 - t) ** 2 * tip[1] + 2 * (1 - t) * t * c2[1] + t * t * ry))
    # curl the tip sideways
    bent = [(x + curl * 0.9 * (max(y, 0) / size) ** 2 * size, y) for x, y in pts]
    c, s = math.cos(rot), math.sin(rot)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in bent]


def draw_wrapped(draw, fn, size_px, *args):
    for ox in (-size_px, 0, size_px):
        for oy in (-size_px, 0, size_px):
            fn(draw, ox, oy, *args)


def bandana(size=2048, seed=4):
    rnd = random.Random(seed)
    img = Image.new('RGB', (size, size), RED)
    d = ImageDraw.Draw(img)
    cell = size // 4
    motifs = []
    for gy in range(4):
        for gx in range(4):
            cx = gx * cell + cell * (0.5 if gy % 2 == 0 else 1.0)
            cy = gy * cell + cell * 0.5
            motifs.append((cx % size, cy, cell * rnd.uniform(0.62, 0.72), rnd.uniform(0, 6.28), rnd.choice([1, -1])))

    def paisley(dr, ox, oy, cx, cy, s, rot, flip):
        x0, y0 = cx + ox, cy + oy
        outer = paisley_points(x0, y0, s, rot, curl=flip)
        # scalloped dots around the outline
        for i in range(0, len(outer), 3):
            x, y = outer[i]
            vx, vy = x - x0, y - y0
            n = math.hypot(vx, vy) or 1
            px, py = x + vx / n * s * 0.07, y + vy / n * s * 0.07
            r = s * 0.024
            dr.ellipse([px - r, py - r, px + r, py + r], fill=CHALK)
        layers = [(1.0, INK), (0.9, CHALK), (0.78, RED), (0.64, CHALK), (0.5, INK), (0.36, RED)]
        for k, col in layers:
            dr.polygon(paisley_points(x0, y0, s, rot, curl=flip, k=k), fill=col)
        r = s * 0.05
        dr.ellipse([x0 - r, y0 - r, x0 + r, y0 + r], fill=CHALK)

    def flower(dr, ox, oy, cx, cy, s):
        for k in range(8):
            a = k * math.pi / 4
            px, py = cx + ox + math.cos(a) * s * 0.5, cy + oy + math.sin(a) * s * 0.5
            r = s * 0.28
            dr.ellipse([px - r, py - r, px + r, py + r], fill=CHALK)
        r = s * 0.32
        dr.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r], fill=INK)
        r = s * 0.12
        dr.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r], fill=CHALK)

    # dot field first
    for _ in range(900):
        x, y = rnd.uniform(0, size), rnd.uniform(0, size)
        r = rnd.choice([3, 4, 5])
        draw_wrapped(d, lambda dr, ox, oy, x=x, y=y, r=r: dr.ellipse([x + ox - r, y + oy - r, x + ox + r, y + oy + r], fill=CHALK), size)
    for m in motifs:
        draw_wrapped(d, paisley, size, *m)
    for gy in range(4):
        for gx in range(4):
            cx = gx * cell + cell * (1.0 if gy % 2 == 0 else 0.5)
            cy = gy * cell + cell * 0.02
            draw_wrapped(d, flower, size, cx % size, cy, cell * 0.11)
    # subtle cotton weave + print wear
    weave = Image.effect_noise((size, size), 28).convert('L').filter(ImageFilter.GaussianBlur(0.6))
    img = Image.blend(img, Image.merge('RGB', (weave, weave, weave)), 0.06)
    return img


def patch(w=512, h=352):
    """Woven label: a single red B on black, readable at small sizes."""
    img = Image.new('RGB', (w, h), INK)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        d.line([(0, y), (w, y)], fill=(31, 31, 31), width=1)
    font = ImageFont.truetype(str(ROOT / 'assets_src' / 'fonts' / 'Anton-Regular.ttf'), 260)
    tb = d.textbbox((0, 0), 'B', font=font)
    d.text(((w - (tb[2] - tb[0])) / 2 - tb[0], (h - (tb[3] - tb[1])) / 2 - tb[1]), 'B', font=font, fill=RED)
    d.rectangle([12, 12, w - 13, h - 13], outline=(120, 118, 112), width=4)
    return img


def main():
    SRC.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    b = bandana()
    b.save(SRC / 'bandana.png')
    b.resize((1024, 1024), Image.LANCZOS).save(WEB / 'bandana.webp', quality=86)
    p = patch()
    p.save(SRC / 'patch.png')
    p.save(WEB / 'patch.webp', quality=90)
    print('textures written')


if __name__ == '__main__':
    main()
