"""Depot category objects: stitched, inflated garments sculpted from 2D pattern outlines.

Run: python tools/depot/build_depot.py [name ...]
Writes OBJ (with planar UVs for prints) to assets_src/depot/ for tools/depot/blender_depot.py.
Units: garments are ~1.2 tall, Y up, front facing +Z.
"""

import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'mascot'))
from build_mascot import mesh_sdf, poly_2d, write_obj  # noqa: E402
from sdf import capsule, ellipsoid, round_rect_2d, smax, smin, value_noise3, vec  # noqa: E402

OUT = HERE.parents[1] / 'assets_src' / 'depot'


def mirror_poly(right):
    """right: points from top-centre clockwise down to bottom-centre (x >= 0)."""
    left = [(-x, y) for x, y in reversed(right)]
    return right + left[1:-1] if right[-1][0] == 0 else right + left


def seg_dist(x, y, a, b):
    ax, ay = a
    bx, by = b
    ex, ey = bx - ax, by - ay
    t = np.clip(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey), 0, 1)
    return np.hypot(x - ax - ex * t, y - ay - ey * t)


def polyline_dist(x, y, pts):
    d = np.full_like(x, 1e3)
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.minimum(d, seg_dist(x, y, a, b))
    return d


class Garment:
    def __init__(self, poly, T, R):
        self.poly, self.T, self.R = poly, T, R

    def d2(self, x, y):
        return poly_2d(x, y, self.poly)

    def h(self, x, y):
        return self.T * np.sqrt(np.clip(-self.d2(x, y) / self.R, 0, 1))

    def base(self, p):
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        d2 = self.d2(x, y)
        h = self.T * np.sqrt(np.clip(-d2 / self.R, 0, 1))
        cloth = 0.006 * value_noise3(p, 9.0, seed=5)
        return np.maximum(d2, np.abs(z) - h - cloth), d2, h

    @staticmethod
    def groove(f, dist, depth=0.008, w=0.006):
        return f + depth * np.exp(-(dist / w) ** 2)

    @staticmethod
    def raised(f, d_shape, h, z, lift=0.012, side=1):
        """A thin layer on the front (side=1) following the body surface, outline d_shape."""
        layer = np.maximum(d_shape, np.abs(z - side * (h + lift * 0.5)) - lift * 0.6)
        return smin(f, layer, 0.006)


def tee(p):
    right = [(0, 0.40), (0.12, 0.52), (0.42, 0.47), (0.71, 0.29), (0.61, 0.11), (0.41, 0.19), (0.43, -0.51), (0, -0.52)]
    g = Garment(mirror_poly(right), 0.085, 0.11)
    f, d2, h = g.base(p)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    neck = [(-0.13, 0.515), (-0.07, 0.44), (0, 0.415), (0.07, 0.44), (0.13, 0.515)]
    nd = polyline_dist(x, y, neck)
    f = smin(f, np.maximum(nd - 0.026, np.abs(z) - h - 0.012), 0.008)            # neck rib
    f = g.groove(f, np.abs(nd - 0.03), 0.006, 0.004)
    xm = np.abs(x)
    f = g.groove(f, seg_dist(xm, y, (0.40, 0.475), (0.405, 0.20)), 0.007, 0.005)  # drop-shoulder seam
    f = g.groove(f, seg_dist(xm, y, (0.665, 0.285), (0.575, 0.13)), 0.007, 0.005)  # sleeve hem
    f = g.groove(f, np.abs(y + 0.455) + (xm > 0.42) * 1.0, 0.007, 0.005)          # body hem
    return f


def shirt(p):
    right = [(0, 0.36), (0.12, 0.55), (0.40, 0.50), (0.66, 0.32), (0.575, 0.14), (0.38, 0.22), (0.40, -0.48), (0.30, -0.60), (0.12, -0.66), (0, -0.67)]
    g = Garment(mirror_poly(right), 0.075, 0.10)
    f, d2, h = g.base(p)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    xm = np.abs(x)
    # camp collar flaps lying on the front
    flap = poly_2d(xm, y, [(0.005, 0.37), (0.13, 0.555), (0.255, 0.515), (0.105, 0.28)])
    f = smin(f, np.maximum(flap, np.abs(z - (h + 0.012)) - 0.014), 0.006)
    f = g.groove(f, polyline_dist(xm, y, [(0.13, 0.55), (0.255, 0.515), (0.105, 0.28)]) , 0.004, 0.003)
    # placket, buttons, chest pocket, seams
    f = g.groove(f, np.abs(x - 0.03) + (y > 0.36) * 1.0, 0.006, 0.004)
    for by in (0.24, 0.07, -0.10, -0.27, -0.44):
        hb = g.h(np.float32(0.0), np.float32(by))
        f = smin(f, ellipsoid(p, vec(0.0, by, float(hb) + 0.004), vec(0.016, 0.016, 0.008)), 0.004)
    pk = round_rect_2d(x - 0.22, y - 0.10, 0.075, 0.085, 0.01)
    f = g.raised(f, pk, h, z, 0.012)
    f = g.groove(f, np.abs(y - 0.165) + (np.abs(x - 0.22) > 0.075) * 1.0, 0.004, 0.003)
    f = g.groove(f, seg_dist(xm, y, (0.39, 0.50), (0.385, 0.22)), 0.007, 0.005)
    f = g.groove(f, seg_dist(xm, y, (0.625, 0.31), (0.545, 0.16)), 0.006, 0.005)
    return f


def jacket(p):
    right = [(0, 0.44), (0.14, 0.56), (0.44, 0.51), (0.82, -0.10), (0.72, -0.22), (0.47, 0.13), (0.47, -0.52), (0, -0.55)]
    g = Garment(mirror_poly(right), 0.105, 0.13)
    f, d2, h = g.base(p)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    xm = np.abs(x)
    # stand collar
    col = poly_2d(xm, y, [(0.0, 0.44), (0.15, 0.565), (0.17, 0.62), (0.0, 0.52)])
    f = smin(f, np.maximum(col, np.abs(z) - 0.08), 0.02)
    # zipper: groove + teeth + pull
    f = g.groove(f, np.abs(x) + (y > 0.47) * 1.0, 0.012, 0.006)
    hz = g.h(np.float32(0.0), np.float32(0.0))
    teeth_y = np.round(y / 0.022) * 0.022
    tooth = np.sqrt((np.abs(x) - 0.006) ** 2 * 6 + (y - teeth_y) ** 2 * 3 + (z - float(hz)) ** 2) - 0.008
    f = smin(f, np.where((y < 0.46) & (y > -0.53), tooth, 1.0), 0.003)
    f = smin(f, ellipsoid(p, vec(0.0, 0.38, float(g.h(np.float32(0), np.float32(0.38))) + 0.012), vec(0.016, 0.04, 0.01)), 0.004)
    # cuffs, waistband, welt pockets, shoulder seams
    f = g.groove(f, seg_dist(xm, y, (0.78, -0.07), (0.68, -0.18)), 0.008, 0.006)
    f = g.groove(f, np.abs(y + 0.46) + (xm > 0.47) * 1.0, 0.008, 0.006)
    f = g.groove(f, seg_dist(xm, y, (0.18, -0.13), (0.27, -0.33)), 0.010, 0.005)
    f = g.groove(f, seg_dist(xm, y, (0.14, 0.555), (0.44, 0.505)), 0.005, 0.004)
    f = g.groove(f, seg_dist(xm, y, (0.44, 0.50), (0.47, 0.14)), 0.006, 0.005)
    # chest patch
    f = g.raised(f, round_rect_2d(x + 0.22, y - 0.22, 0.06, 0.04, 0.008), h, z, 0.01)
    return f


def pants(p):
    poly = [(-0.33, 0.56), (0.33, 0.56), (0.405, -0.88), (0.05, -0.89), (0.0, 0.10), (-0.05, -0.89), (-0.405, -0.88)]
    g = Garment(poly, 0.095, 0.10)
    f, d2, h = g.base(p)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    xm = np.abs(x)
    f = g.groove(f, np.abs(y - 0.47) + (xm > 0.33) * 1.0, 0.008, 0.006)              # waistband
    for lx in (0.11, 0.27):
        loop = round_rect_2d(xm - lx, y - 0.515, 0.012, 0.05, 0.004)
        f = g.raised(f, loop, h, z, 0.014)
    f = g.groove(f, polyline_dist(x, y, [(0.0, 0.46), (0.0, 0.24), (0.05, 0.19), (0.07, 0.26), (0.07, 0.46)]), 0.006, 0.004)  # fly
    f = g.groove(f, seg_dist(xm, y, (0.31, 0.46), (0.23, 0.30)), 0.008, 0.005)          # slant pockets
    # cargo pockets with flaps and buttons
    pk = round_rect_2d(xm - 0.27, y + 0.30, 0.08, 0.12, 0.012)
    f = g.raised(f, pk, h, z, 0.018)
    flap = round_rect_2d(xm - 0.27, y + 0.16, 0.085, 0.035, 0.01)
    f = g.raised(f, flap, h, z, 0.03)
    for sx in (-1, 1):
        f = smin(f, ellipsoid(p, vec(sx * 0.27, -0.14, float(g.h(np.float32(0.27), np.float32(-0.14))) + 0.032), vec(0.013, 0.013, 0.006)), 0.003)
    f = g.groove(f, np.abs(y + 0.52) + ((xm < 0.07) | (xm > 0.39)) * 1.0, 0.006, 0.004)   # knee darts
    f = g.groove(f, np.abs(y + 0.81) + (xm < 0.06) * 1.0, 0.007, 0.005)                   # hem
    f = g.groove(f, seg_dist(xm, y, (0.36, 0.45), (0.40, -0.86)), 0.004, 0.004)           # side seam
    return f


def bandana(p):
    poly = [(-0.58, 0.30), (0.58, 0.30), (0.03, -0.46), (-0.03, -0.46)]
    g = Garment(poly, 0.028, 0.05)
    f, d2, h = g.base(p)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    # folded top edge: a soft roll
    roll = capsule(p * np.array([1, 1, 1.6], np.float32), vec(-0.55, 0.285, 0), vec(0.55, 0.285, 0), 0.04)
    f = smin(f, roll, 0.02)
    f = g.groove(f, np.abs(d2 + 0.03), 0.004, 0.004)        # hem stitch
    return f


def uv_planar(v, w=1.7, h=1.4):
    return np.stack([(v[:, 0] + w / 2) / w, (v[:, 1] + h / 2) / h], 1)


PARTS = {
    'tee': (tee, (-0.75, -0.56, -0.13), (0.75, 0.56, 0.13), 0.0045),
    'shirt': (shirt, (-0.70, -0.70, -0.13), (0.70, 0.60, 0.13), 0.0045),
    'jacket': (jacket, (-0.86, -0.58, -0.16), (0.86, 0.66, 0.16), 0.0048),
    'pants': (pants, (-0.44, -0.92, -0.15), (0.44, 0.60, 0.15), 0.0045),
    'bandana': (bandana, (-0.64, -0.50, -0.08), (0.64, 0.36, 0.08), 0.0035),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or list(PARTS):
        fn, lo, hi, vox = PARTS[name]
        t = time.time()
        v, f = mesh_sdf(fn, lo, hi, vox)
        write_obj(OUT / f'{name}.obj', v, f, uv_planar(v))
        print(f'{name}: {len(v)} verts {time.time() - t:.1f}s', flush=True)


if __name__ == '__main__':
    main()
