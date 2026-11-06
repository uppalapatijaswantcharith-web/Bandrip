"""Spray-paint simulator for BANDRIP graffiti assets (numpy + scipy + Pillow).

Paint is modelled as density: a soft core (nozzle falloff), uneven pressure (fbm),
a wide low-alpha overspray halo, speckles where the halo thins, and gravity drips
that run from heavy edges and end in a bulb. Layers composite with "over".
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

RNG = np.random.default_rng(7)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def fbm(h, w, scale=64, octaves=4, seed=0):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        gh, gw = max(2, int(h / s) + 2), max(2, int(w / s) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        up = np.array(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
        out += up * amp
        tot += amp
        amp *= 0.5
        s /= 2
    return out / tot


def text_mask(text, font_path, size, pad=60, stroke=0, rotate=0.0, tracking=0):
    font = ImageFont.truetype(str(font_path), size)
    tmp = Image.new('L', (10, 10))
    d = ImageDraw.Draw(tmp)
    if tracking:
        widths = [d.textbbox((0, 0), ch, font=font, stroke_width=stroke)[2] for ch in text]
        tw = sum(widths) + tracking * (len(text) - 1)
        bb = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
        th = bb[3] - bb[1]
        img = Image.new('L', (int(tw + 2 * pad), int(th + 2 * pad)), 0)
        dd = ImageDraw.Draw(img)
        x = pad
        for ch, w in zip(text, widths):
            dd.text((x, pad - bb[1]), ch, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
            x += w + tracking
    else:
        bb = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
        img = Image.new('L', (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad), 0)
        ImageDraw.Draw(img).text((pad - bb[0], pad - bb[1]), text, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    if rotate:
        img = img.rotate(rotate, resample=Image.BICUBIC, expand=True)
    return np.asarray(img, np.float32) / 255


def path_mask(h, w, paths, width):
    """Rasterise polylines (list of [(x, y), ...]) with round joins."""
    img = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(img)
    for pts in paths:
        d.line(pts, fill=255, width=int(width), joint='curve')
        r = width / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return np.asarray(img, np.float32) / 255


def dilate(mask, px):
    if px <= 0:
        return mask
    dist = ndimage.distance_transform_edt(mask < 0.5)
    return np.clip((px - dist) / 1.5 + 0.5, 0, 1).astype(np.float32)


def shift(mask, dx, dy):
    return ndimage.shift(mask, (dy, dx), order=1, mode='constant')


def spray(mask, color, opacity=1.0, edge=2.2, grain=0.28, overspray=9.0, halo=0.22, speck=0.9, seed=0):
    """Returns (rgb, alpha) for a sprayed fill of `mask`."""
    h, w = mask.shape
    rng = np.random.default_rng(seed)
    core = ndimage.gaussian_filter(mask, edge)
    press = 1.0 - grain * fbm(h, w, 90, 4, seed) - 0.12 * fbm(h, w, 12, 2, seed + 1)
    dens = np.clip(core * 1.25, 0, 1) * press
    wide = ndimage.gaussian_filter(mask, overspray)
    ring = np.clip(wide - core * 0.9, 0, 1)
    spk = (rng.random((h, w)) < ring * 0.05 * speck).astype(np.float32)
    spk = np.clip(ndimage.gaussian_filter(spk, 0.6) * 3.0, 0, 1)
    alpha = np.clip(dens + ring * halo + spk * 0.7, 0, 1) * opacity
    rgb = np.broadcast_to(hexrgb(color), (h, w, 3)).copy()
    # slightly darker where paint pooled
    rgb *= (1.0 - 0.10 * np.clip(dens - 0.85, 0, 1)[..., None] * 4)
    return rgb, alpha


def drips(mask, count=14, max_len=160, width=(5, 11), seed=0, prob_edge=0.5):
    """Gravity drips hanging from the lower edges of a painted shape."""
    h, w = mask.shape
    rng = np.random.default_rng(seed)
    m = mask > 0.5
    below = np.zeros_like(m)
    below[:-1] = m[:-1] & ~m[1:]
    ys, xs = np.nonzero(below)
    out = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(out)
    if len(xs) == 0:
        return np.zeros((h, w), np.float32)
    idx = rng.choice(len(xs), size=min(count, len(xs)), replace=False)
    for i in idx:
        x, y = int(xs[i]), int(ys[i])
        L = int(rng.uniform(0.25, 1.0) ** 1.6 * max_len)
        wd = rng.uniform(*width)
        for k in range(L):
            ww = wd * (1 - 0.35 * k / max(L, 1))
            d.ellipse([x - ww / 2, y + k - ww / 2, x + ww / 2, y + k + ww / 2], fill=255)
        r = wd * 0.75
        d.ellipse([x - r, y + L - r, x + r, y + L + r], fill=255)
    return np.asarray(out, np.float32) / 255


def over(dst, rgb, alpha):
    """Composite (rgb, alpha) over dst (H, W, 4) straight-alpha float."""
    a = alpha[..., None]
    da = dst[..., 3:4]
    out_a = a + da * (1 - a)
    out_rgb = (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(out_a, 1e-6)
    dst[..., :3] = out_rgb
    dst[..., 3:4] = out_a
    return dst


def blank(h, w):
    return np.zeros((h, w, 4), np.float32)


def place(canvas, layer_rgb, layer_a, x, y):
    """Composite a smaller layer onto canvas at (x, y) top-left."""
    h, w = layer_a.shape
    H, W = canvas.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return canvas
    sub = canvas[y0:y1, x0:x1]
    over(sub, layer_rgb[y0 - y:y1 - y, x0 - x:x1 - x], layer_a[y0 - y:y1 - y, x0 - x:x1 - x])
    return canvas


def to_image(rgba):
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA')


def crop_alpha(img, pad=8):
    bb = img.getbbox()
    if not bb:
        return img
    return img.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(img.width, bb[2] + pad), min(img.height, bb[3] + pad)))
