"""Grade, resize and catalogue the temporary filler photography.

One consistent treatment for every frame (see ART_DIRECTION.md, "Photography"):
slight desaturation, lifted ink blacks, chalk-toned highlights, fine mono grain.
Outputs WebP at 800w and 1600w plus a 24px placeholder and web/data/photos.json.

Run: python tools/process_photos.py
"""

import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from tools.photos_manifest import PHOTOS  # noqa: E402

SRC = ROOT / 'assets_src' / 'photos'
OUT = ROOT / 'static' / 'img' / 'photos'
DATA = ROOT / 'web' / 'data' / 'photos.json'
WIDTHS = (800, 1600)

INK = np.array([21, 21, 21], dtype=np.float32)
CHALK = np.array([242, 240, 233], dtype=np.float32)


def grade(im: Image.Image, seed: int) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(0.86)
    a = np.asarray(im).astype(np.float32) / 255.0
    # gentle S-curve
    a = a + 0.06 * np.sin((a - 0.5) * np.pi) * (1 - np.abs(a - 0.5) * 2) * 2
    a = np.clip(a, 0, 1)
    # map black/white points to ink/chalk (lifted blacks, warm paper whites)
    lo, hi = INK / 255.0, CHALK / 255.0
    a = lo + a * (hi - lo)
    # fine mono grain, stronger in mid-tones
    rng = np.random.default_rng(seed)
    lum = a.mean(axis=2, keepdims=True)
    grain = rng.normal(0, 0.018, a.shape[:2])[..., None] * (1 - np.abs(lum - 0.5) * 1.4)
    a = np.clip(a + grain, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    catalogue = []
    for pid, slug, author, cats, alt, verified in PHOTOS:
        src = SRC / f'{pid}.jpg'
        im = Image.open(src).convert('RGB')
        w, h = im.size
        graded = grade(im, pid)
        files = {}
        for tw in WIDTHS:
            tw_eff = min(tw, w)
            th = round(h * tw_eff / w)
            out = OUT / f'{pid}-{tw}.webp'
            graded.resize((tw_eff, th), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
            files[str(tw)] = f'img/photos/{pid}-{tw}.webp'
        tiny = graded.resize((24, max(1, round(24 * h / w))), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1))
        buf = io.BytesIO()
        tiny.save(buf, 'WEBP', quality=40)
        avg = np.asarray(graded.resize((1, 1), Image.BOX))[0, 0]
        catalogue.append({
            'id': pid,
            'alt': alt,
            'categories': cats,
            'width': w,
            'height': h,
            'ratio': round(w / h, 4),
            'orientation': 'landscape' if w > h * 1.05 else 'portrait',
            'src': files,
            'placeholder': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
            'tone': '#%02x%02x%02x' % tuple(int(c) for c in avg),
            'credit': author,
            'source': f'https://www.pexels.com/photo/{slug}-{pid}/',
            'licence': 'Pexels License',
            'credit_verified': verified,
            'temporary': True,
        })
        print(pid, w, h)
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(catalogue, indent=1, ensure_ascii=False), encoding='utf-8')
    print('wrote', DATA, len(catalogue))


if __name__ == '__main__':
    main()
