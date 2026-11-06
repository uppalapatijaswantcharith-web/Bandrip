"""Sculpt the BANDRIP mascot parts as signed distance fields and mesh them.

Coordinate frame: +Y up, the face looks down +Z, skull height ~2.3 units.
Outputs OBJ files to assets_src/mascot/ for tools/mascot/blender_finish.py.

Run: python tools/mascot/build_mascot.py [part ...]
"""

import sys
import time
from pathlib import Path

import numpy as np
from skimage.measure import marching_cubes

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sdf import (  # noqa: E402
    capsule, capsule_tapered, ellipse_2d, ellipsoid, mirror_x, rot_x, rot_z,
    round_box, round_rect_2d, smax, smin, ssub, value_noise3, vec,
)

OUT = Path(__file__).resolve().parents[2] / 'assets_src' / 'mascot'


def X(p):
    return p[..., 0]


def Y(p):
    return p[..., 1]


def Z(p):
    return p[..., 2]


# ---------------------------------------------------------------- skull
# Proportions follow an adult human skull scaled so cranial breadth ~1.45 units
# (1 unit ~ 97 mm): orbit ~0.40 x 0.35, nasal aperture ~0.25 x 0.34,
# nasion -> alveolar point ~0.70, bizygomatic breadth ~ cranial breadth.
UPPER_ROOT, UPPER_H = -0.600, 0.106
LOWER_ROOT, LOWER_H = -0.812, 0.090
MOUTH_C = (UPPER_ROOT + LOWER_ROOT) / 2
MOUTH_HALF = (UPPER_ROOT - LOWER_ROOT) / 2 + 0.004


def teeth_arc_z(x):
    ax = np.abs(x)
    return 0.672 - 2.1 * ax * ax - 5.0 * np.maximum(0.0, ax - 0.17) ** 2


def teeth_arc_slope(x):
    ax = abs(x)
    return -(4.2 * ax + 10.0 * max(0.0, ax - 0.17)) * (1 if x >= 0 else -1)


def teeth_layout():
    """Tooth placements shared by the teeth sculpt and the maxilla root ridges."""
    rows = [
        # central incisor, lateral incisor, canine, premolar 1, premolar 2, molar 1
        ('upper', [0.074, 0.060, 0.064, 0.060, 0.058, 0.082], UPPER_ROOT, UPPER_H, 1, 0.0),
        ('lower', [0.048, 0.052, 0.060, 0.060, 0.060, 0.084], LOWER_ROOT, LOWER_H, -1, -0.024),
    ]
    kinds = ['incisor', 'incisor', 'canine', 'premolar', 'premolar', 'molar']
    out = []
    for row, widths, root, height, sign, zoff in rows:
        for side in (-1, 1):
            x = 0.0
            for i, w in enumerate(widths):
                seg, step = w + 0.0025, 0.0
                while step < seg:
                    dx = 0.0005
                    step += float(np.hypot(dx, teeth_arc_z(x + dx) - teeth_arc_z(x)))
                    x += dx
                cx = (x - seg / 2) * side
                h = height * {0: 1.06 if row == 'upper' else 0.95, 1: 0.94, 2: 1.12, 3: 0.86, 4: 0.82, 5: 0.74}[i]
                out.append({'row': row, 'i': i, 'kind': kinds[i], 'x': cx, 'w': w, 'h': h, 'root': root,
                            'sign': sign, 'z': float(teeth_arc_z(abs(cx))) + zoff,
                            'depth': {0: 0.058, 1: 0.056, 2: 0.068, 3: 0.075, 4: 0.078, 5: 0.092}[i]})
    return out


TEETH = teeth_layout()


def skull(p):
    pm = mirror_x(p)
    x, y, z = X(p), Y(p), Z(p)
    # --- neurocranium
    d = ellipsoid(p, vec(0, 0.30, -0.16), vec(0.72, 0.80, 0.94))
    d = smin(d, ellipsoid(p, vec(0, 0.18, 0.20), vec(0.61, 0.60, 0.62)), 0.22)      # frontal squama
    d = smax(d, np.abs(x) - 0.69, 0.22)                                              # parietal flattening
    d = smin(d, ellipsoid(p, vec(0, 0.02, -0.80), vec(0.46, 0.40, 0.32)), 0.16)     # occipital curve
    d = ssub(d, ellipsoid(p, vec(0, -0.55, -0.55), vec(0.50, 0.25, 0.45)), 0.12)    # skull base undercut
    # temporal fossa and temporal line
    d = ssub(d, ellipsoid(pm, vec(0.78, -0.03, -0.02), vec(0.15, 0.26, 0.32)), 0.12)
    # --- brow: glabella and supraorbital margins
    d = smin(d, ellipsoid(p, vec(0, 0.10, 0.80), vec(0.10, 0.07, 0.05)), 0.06)
    d = smin(d, capsule(pm, vec(0.05, 0.155, 0.785), vec(0.43, 0.148, 0.625), 0.044), 0.07)
    # --- zygomatic bone: body, lateral orbital pillar, arch
    d = smin(d, ellipsoid(pm, vec(0.48, -0.22, 0.46), vec(0.15, 0.115, 0.15)), 0.07)
    d = smin(d, capsule(pm, vec(0.52, -0.16, 0.51), vec(0.53, 0.13, 0.58), 0.045), 0.05)
    d = smin(d, capsule(pm, vec(0.57, -0.24, 0.34), vec(0.64, -0.22, 0.02), 0.05), 0.055)
    d = smin(d, capsule(pm, vec(0.64, -0.22, 0.02), vec(0.57, -0.235, -0.16), 0.045), 0.05)
    d = smin(d, ellipsoid(pm, vec(0.56, -0.26, -0.24), vec(0.09, 0.13, 0.17)), 0.10)
    # --- midface: maxilla body, lower maxilla, alveolar margin
    d = smin(d, ellipsoid(p, vec(0, -0.22, 0.38), vec(0.46, 0.34, 0.41)), 0.14)
    d = smin(d, ellipsoid(p, vec(0, -0.47, 0.40), vec(0.33, 0.14, 0.29)), 0.09)
    d = smin(d, ellipsoid(p, vec(0, -0.575, 0.37), vec(0.315, 0.05, 0.30)), 0.04)
    # nasal bones (bridge) from nasion down to the aperture
    d = smin(d, capsule(p, vec(0, 0.07, 0.80), vec(0, -0.11, 0.86), 0.042), 0.05)
    # canine fossae
    d = ssub(d, ellipsoid(pm, vec(0.25, -0.37, 0.70), vec(0.085, 0.075, 0.05)), 0.06)
    # tooth-root ridges (jugae) above the upper teeth
    for t in TEETH:
        if t['row'] == 'upper' and t['i'] <= 3:
            c = vec(t['x'], UPPER_ROOT + 0.06, t['z'] - 0.032)
            d = smin(d, ellipsoid(p, c, vec(t['w'] * 0.34, 0.085 if t['i'] == 2 else 0.065, 0.028)), 0.02)
    # --- mandible: symphysis, body, broad rami, condyles, coronoids, alveolar ridge
    mand = ellipsoid(p, vec(0, -0.96, 0.42), vec(0.25, 0.12, 0.19))
    mand = smin(mand, ellipsoid(p, vec(0, -1.00, 0.51), vec(0.12, 0.07, 0.07)), 0.05)
    mand = smin(mand, capsule(pm, vec(0.12, -0.95, 0.46), vec(0.45, -0.91, 0.05), 0.09), 0.10)
    mand = smin(mand, ramus(pm), 0.05)
    mand = smin(mand, ellipsoid(p, vec(0, -0.84, 0.38), vec(0.30, 0.055, 0.29)), 0.045)
    for t in TEETH:  # lower jugae
        if t['row'] == 'lower' and t['i'] <= 2:
            c = vec(t['x'], LOWER_ROOT - 0.05, t['z'] - 0.03)
            mand = smin(mand, ellipsoid(p, c, vec(t['w'] * 0.32, 0.06, 0.026)), 0.02)
    d = smin(d, ellipsoid(p, vec(0, -0.44, 0.02), vec(0.50, 0.17, 0.40)), 0.10)      # skull base / pterygoids
    d = ssub(d, ellipsoid(p, vec(0, MOUTH_C, 0.16), vec(0.44, 0.04, 0.42)), 0.03)
    d = smin(d, mand, 0.035)
    # mastoid process and external acoustic meatus (ear canal)
    d = smin(d, ellipsoid(pm, vec(0.56, -0.40, -0.32), vec(0.085, 0.14, 0.10)), 0.08)
    d = ssub(d, capsule(pm, vec(0.60, -0.28, -0.20), vec(0.82, -0.28, -0.20), 0.042), 0.015)
    # --- orbits: rounded-square cavities, slightly tilted, deep cone behind
    q = rot_z(pm - vec(0.32, 0.0, 0.72), 0.10)
    d = ssub(d, round_box(q, vec(0, 0, 0), vec(0.198, 0.170, 0.28), 0.10), 0.03)
    d = ssub(d, ellipsoid(pm, vec(0.27, -0.01, 0.42), vec(0.14, 0.12, 0.26)), 0.06)
    d = ssub(d, ellipsoid(pm, vec(0.22, -0.03, 0.20), vec(0.06, 0.05, 0.2)), 0.03)    # optic canal shadow
    # supraorbital notch, infraorbital and zygomaticofacial foramina
    d = ssub(d, sphere_(pm, vec(0.20, 0.175, 0.80), 0.012), 0.006)
    d = ssub(d, capsule(pm, vec(0.235, -0.215, 0.80), vec(0.22, -0.20, 0.62), 0.0145), 0.008)
    d = ssub(d, capsule(pm, vec(0.47, -0.16, 0.64), vec(0.44, -0.15, 0.52), 0.008), 0.005)
    # --- nasal aperture: pear shape, sharp margins, septum and conchae inside
    nas = smin(ellipsoid(p, vec(0, -0.335, 0.80), vec(0.125, 0.115, 0.26)),
               ellipsoid(p, vec(0, -0.17, 0.82), vec(0.06, 0.12, 0.26)), 0.06)
    d = ssub(d, nas, 0.015)
    d = smin(d, round_box(p, vec(0, -0.30, 0.60), vec(0.008, 0.12, 0.10), 0.006), 0.01)   # vomer / septum
    d = smin(d, ellipsoid(pm, vec(0.075, -0.37, 0.63), vec(0.035, 0.028, 0.12)), 0.02)   # inferior conchae
    d = smin(d, ellipsoid(p, vec(0, -0.455, 0.765), vec(0.022, 0.011, 0.045)), 0.012)    # anterior nasal spine
    # --- mouth channel where the teeth sit
    mouth = np.maximum(np.maximum(np.abs(y - MOUTH_C) - MOUTH_HALF, (teeth_arc_z(x) - 0.07) - z), np.abs(x) - 0.38)
    d = ssub(d, mouth, 0.016)
    # bone surface irregularity (fine detail comes from the baked normal map)
    d = d + 0.004 * value_noise3(p, 11.0, seed=3) + 0.0015 * value_noise3(p, 41.0, seed=7)
    return d


def poly_2d(px, py, V):
    """Signed distance to a simple polygon (list of (x, y))."""
    d = (px - V[0][0]) ** 2 + (py - V[0][1]) ** 2
    sgn = np.ones_like(px)
    j = len(V) - 1
    for i in range(len(V)):
        ex, ey = V[j][0] - V[i][0], V[j][1] - V[i][1]
        wx, wy = px - V[i][0], py - V[i][1]
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        bx, by = wx - ex * t, wy - ey * t
        d = np.minimum(d, bx * bx + by * by)
        c1, c2, c3 = py >= V[i][1], py < V[j][1], ex * wy > ey * wx
        sgn = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -sgn, sgn)
        j = i
    return sgn * np.sqrt(d)


RAMUS = [(-0.145, -0.325), (0.085, -0.345), (0.175, -0.84), (-0.015, -0.955), (-0.105, -0.885)]


def ramus(pm):
    """Mandibular ramus: side-plane profile as a thin plate with condyle, coronoid and sigmoid notch."""
    x, y, z = X(pm), Y(pm), Z(pm)
    d2 = poly_2d(z, y, RAMUS) + 0.02
    notch = np.sqrt((z + 0.03) ** 2 + (y + 0.335) ** 2) - 0.062
    d2 = smax(d2, -notch, 0.02)
    xc = 0.545 + (y + 0.33) * 0.11
    slab = np.abs(x - xc) - 0.016
    d = np.minimum(np.maximum(d2, slab), 0) + np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(slab, 0) ** 2) - 0.012
    d = smin(d, ellipsoid(pm, vec(0.548, -0.318, -0.135), vec(0.062, 0.036, 0.046)), 0.02)   # condyle
    d = smin(d, capsule(pm, vec(0.536, -0.40, -0.04), vec(0.522, -0.62, -0.10), 0.02), 0.03)   # posterior border
    return d


def sphere_(p, c, r):
    return np.sqrt(np.sum((p - c) ** 2, axis=-1)) - r


def _tooth(p, t):
    """Signed distance to one tooth crown (+ a short root into the bone)."""
    sx = -teeth_arc_slope(t['x'])
    tang = np.array([1.0, 0.0, -sx], np.float32) / np.sqrt(1 + sx * sx)
    norm = np.array([sx, 0.0, 1.0], np.float32) / np.sqrt(1 + sx * sx)
    c = np.array([t['x'], 0.0, t['z'] - t['depth'] / 2], np.float32)
    q = p - c
    u = q[..., 0] * tang[0] + q[..., 2] * tang[2]
    w = q[..., 0] * norm[0] + q[..., 2] * norm[2]
    v = (t['root'] - q[..., 1]) * t['sign']          # 0 at the gum line, + toward the biting edge
    h, hw0, hd0 = t['h'], t['w'] / 2 * 0.97, t['depth'] / 2
    tt = np.clip(v / h, 0.0, 1.0)
    kind = t['kind']
    if kind == 'incisor':
        hw = hw0 * (0.80 + 0.20 * tt)
        hd = hd0 * (1.0 - 0.62 * tt)
        r = 0.006
        w = w - 0.18 * (u * u) / max(hw0, 1e-3) * 0.5    # labial convexity
    elif kind == 'canine':
        hw = hw0 * (1.0 - 0.72 * tt ** 1.7)
        hd = hd0 * (1.0 - 0.35 * tt)
        r = 0.008
    elif kind == 'premolar':
        hw = hw0 * (0.86 + 0.14 * np.sin(tt * np.pi * 0.9))
        hd = hd0 * 0.95
        r = 0.011
    else:
        hw = hw0
        hd = hd0
        r = 0.014
    vc, hv = (h - 0.04) / 2, (h + 0.04) / 2           # extend 0.04 into the jaw
    qx = np.abs(u) - (hw - r)
    qy = np.abs(v - vc) - (hv - r)
    qz = np.abs(w) - (hd - r)
    d = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2 + np.maximum(qz, 0) ** 2) + np.minimum(np.maximum(np.maximum(qx, qy), qz), 0) - r
    if kind in ('premolar', 'molar'):
        # cusps: bumps on the biting surface
        for cu in ((-0.45, 0.25), (0.45, 0.25), (-0.45, -0.3), (0.45, -0.3))[: (2 if kind == 'premolar' else 4)]:
            bump = np.sqrt((u - cu[0] * hw0) ** 2 + (v - h) ** 2 * 2.2 + (w - cu[1] * hd0) ** 2) - hw0 * 0.42
            d = smin(d, bump, 0.012)
        d = np.maximum(d, v - h - 0.008)
    # incisal mamelons / slight wear: tiny wave on the biting edge
    if kind == 'incisor':
        d = d + 0.0025 * np.cos(u / max(hw0, 1e-3) * 3 * np.pi) * np.clip((v - h * 0.85) / (h * 0.15), 0, 1)
    return d


def teeth(p):
    xs = p[..., 0]
    lo, hi = float(xs.min()) - 0.08, float(xs.max()) + 0.08
    d = np.full(p.shape[:-1], 10.0, np.float32)
    for t in TEETH:
        if lo <= t['x'] <= hi:
            d = np.minimum(d, _tooth(p, t))
    return d


# ---------------------------------------------------------------- cap
CAP_C = vec(0, 0.36, -0.10)
CAP_R = vec(0.83, 0.86, 0.99)


def cap_open_y(z):
    return 0.105 + 0.095 * z


def cap_crown_outer(p):
    return ellipsoid(p, CAP_C, CAP_R)


def cap(p):
    x, y, z = X(p), Y(p), Z(p)
    outer = cap_crown_outer(p)
    # structured front: slightly fuller front panels
    outer = smin(outer, ellipsoid(p, vec(0, 0.62, 0.30), vec(0.55, 0.50, 0.55)), 0.10)
    crown = smax(outer, cap_open_y(z) - y, 0.02)
    # six panel seams (three planes through the crown axis) + top-stitching
    zz = z - CAP_C[2]
    for ang in (0.0, np.pi / 3, 2 * np.pi / 3):
        dist = np.abs(x * np.cos(ang) - zz * np.sin(ang))
        upper = np.clip((y - 0.25) / 0.4, 0, 1)
        crown = crown + upper * (0.011 * np.exp(-(dist / 0.011) ** 2)
                                 + 0.0025 * np.exp(-((dist - 0.032) / 0.004) ** 2))
    # sweatband rim stitch line
    rim = np.abs(y - cap_open_y(z) - 0.045)
    crown = crown + 0.0025 * np.exp(-(rim / 0.004) ** 2)
    # eyelets, one per panel
    for k in range(6):
        a = np.pi / 6 + k * np.pi / 3
        e = vec(0.62 * np.sin(a), 0.92, CAP_C[2] + 0.74 * np.cos(a))
        r = np.sqrt((x - e[0]) ** 2 + (y - e[1]) ** 2 + (z - e[2]) ** 2)
        crown = crown + 0.010 * np.exp(-((r - 0.016) / 0.006) ** 2) * (r < 0.05)
    # top button
    crown = smin(crown, ellipsoid(p, vec(0, 1.205, -0.10), vec(0.058, 0.032, 0.058)), 0.012)
    # brim: D-shaped, curved down at the sides and toward the tip
    yb = (y - 0.19) + 0.33 * x * x + 0.11 * (z - 0.85)
    d2 = ellipse_2d(x, z - 0.86, 0.66, 0.60)
    ds = np.abs(yb) - 0.012
    brim = np.minimum(np.maximum(d2, ds), 0) + np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(ds, 0) ** 2) - 0.008
    brim = np.maximum(brim, -outer)
    # brim top-stitch rows
    brim = brim + 0.002 * (np.exp(-((d2 + 0.03) / 0.004) ** 2) + np.exp(-((d2 + 0.06) / 0.004) ** 2)) * (yb > 0)
    return smin(crown, brim, 0.018)


_PATCH = {}


def _surface_z(fn, x, y, z0=1.4, z1=0.3):
    zs = np.linspace(z0, z1, 2200, dtype=np.float32)
    pts = np.stack([np.full_like(zs, x), np.full_like(zs, y), zs], -1)
    vals = fn(pts)
    return float(zs[np.argmax(vals < 0)])


def patch(p):
    # small woven label on the front panel, tilted to match the crown slope
    if not _PATCH:
        y0 = 0.60
        z0 = max(_surface_z(cap, 0.07, y0), _surface_z(cap, -0.07, y0)) + 0.004
        z1 = max(_surface_z(cap, 0.07, y0 + 0.04), _surface_z(cap, -0.07, y0 + 0.04)) + 0.004
        _PATCH['c'] = vec(0, y0, z0 + 0.002)
        _PATCH['tilt'] = float(np.arctan2(z0 - z1, 0.04))
    q = rot_x(p - _PATCH['c'], _PATCH['tilt'])
    return round_box(q, vec(0, 0, 0), vec(0.115, 0.078, 0.012), 0.008)


# ---------------------------------------------------------------- sunglasses
def glasses_zc(x):
    return 0.905 - 0.56 * x * x


def lens_2d(x, y):
    xl = np.abs(x) - 0.305
    yl = y - 0.0
    # wayfarer: wider at the top, tapered toward the nose at the bottom
    xs = xl / (1.0 + 0.16 * np.clip(yl / 0.12, -1, 1))
    return round_rect_2d(xs + 0.01 * np.clip(-yl / 0.12, 0, 1), yl, 0.205, 0.122, 0.062)


def glasses_frame(p):
    x, y, z = X(p), Y(p), Z(p)
    l2 = lens_2d(x, y)
    w = 0.022 + 0.022 * np.clip(y / 0.11, 0, 1)
    ring = np.maximum(l2 - w, -l2 - 0.002)
    slab = np.abs(z - glasses_zc(x)) - 0.022
    front = np.minimum(np.maximum(ring, slab), 0) + np.sqrt(np.maximum(ring, 0) ** 2 + np.maximum(slab, 0) ** 2) - 0.004
    bridge = capsule(p, vec(-0.10, 0.06, glasses_zc(0.1)), vec(0.10, 0.06, glasses_zc(0.1)), 0.019)
    bridge = smin(bridge, capsule(p, vec(-0.06, 0.075, glasses_zc(0.0) + 0.004), vec(0.06, 0.075, glasses_zc(0.0) + 0.004), 0.016), 0.02)
    d = smin(front, bridge, 0.02)
    pm = mirror_x(p)
    hinge = round_box(pm, vec(0.512, 0.075, glasses_zc(0.512) - 0.01), vec(0.03, 0.03, 0.035), 0.01)
    temple = capsule_tapered(pm, vec(0.52, 0.075, glasses_zc(0.52) - 0.03), vec(0.665, 0.085, -0.06), 0.017, 0.013)
    d = smin(d, smin(hinge, temple, 0.02), 0.015)
    # small metal rivets on the front corners
    d = smin(d, ellipsoid(pm, vec(0.455, 0.085, glasses_zc(0.455) + 0.02), vec(0.012, 0.012, 0.008)), 0.004)
    return d


def glasses_lens(p):
    x, y, z = X(p), Y(p), Z(p)
    l2 = lens_2d(x, y) + 0.004
    slab = np.abs(z - glasses_zc(x) - 0.004) - 0.010
    return np.minimum(np.maximum(l2, slab), 0) + np.sqrt(np.maximum(l2, 0) ** 2 + np.maximum(slab, 0) ** 2) - 0.002


# ---------------------------------------------------------------- bandana
def neck_core(p):
    core = capsule_tapered(p, vec(0, -0.62, -0.14), vec(0, -1.85, 0.02), 0.30, 0.46)
    pm = mirror_x(p)
    # lower jaw volume so the cloth follows the chin
    jaw = ellipsoid(p, vec(0, -0.99, 0.40), vec(0.29, 0.15, 0.25))
    jaw = smin(jaw, capsule(pm, vec(0.12, -0.97, 0.45), vec(0.46, -0.90, 0.08), 0.11), 0.10)
    rami = ellipsoid(pm, vec(0.50, -0.74, -0.05), vec(0.10, 0.22, 0.17))
    return smin(smin(core, jaw, 0.16), rami, 0.12)


def band_theta(p):
    return np.arctan2(X(p), Z(p) + 0.05)


def bandana(p):
    x, y, z = X(p), Y(p), Z(p)
    th = band_theta(p)
    base = neck_core(p)
    drop = np.clip((-0.95 - y) / 0.6, 0, 1)
    folds = (0.020 * np.sin(th * 9.0 + 2.3 * y) * (0.35 + drop)
             + 0.012 * np.sin(th * 17.0 - 4.0 * y) * drop
             + 0.010 * value_noise3(p, 7.0, seed=11))
    surf = base - 0.065 - folds - 0.10 * drop * np.clip(np.cos(th), 0, 1) ** 2
    shell = np.abs(surf) - 0.013
    y_top = -0.94 + 0.40 * (1 - np.cos(th)) / 2 + 0.018 * np.sin(5 * th)
    y_bot = -1.17 - 0.52 * np.clip(np.cos(th), 0, 1) ** 2.4 + 0.02 * np.sin(7 * th)
    shell = smax(shell, y - y_top, 0.012)
    shell = smax(shell, y_bot - y, 0.012)
    # rolled hems
    hem_t = np.sqrt(np.maximum(surf, -surf) ** 2 * 0 + (y - y_top) ** 2 + surf ** 2) - 0.02
    hem_b = np.sqrt((y - y_bot) ** 2 + surf ** 2) - 0.018
    shell = smin(shell, np.maximum(hem_t, np.abs(y - y_top) - 0.03), 0.01)
    shell = smin(shell, np.maximum(hem_b, np.abs(y - y_bot) - 0.03), 0.01)
    # knot at the back-right with two tails
    kc = vec(0.27, -0.80, -0.44)
    knot = ellipsoid(p, kc, vec(0.095, 0.075, 0.085))
    knot = smin(knot, ellipsoid(p, kc + vec(-0.06, 0.02, 0.03), vec(0.07, 0.06, 0.07)), 0.03)
    t1 = capsule_tapered(p, kc + vec(0.02, -0.03, -0.02), vec(0.40, -1.40, -0.55), 0.06, 0.035)
    t2 = capsule_tapered(p, kc + vec(-0.03, -0.03, -0.03), vec(0.16, -1.34, -0.66), 0.055, 0.03)
    tails = smin(t1, t2, 0.04)
    tails = np.maximum(tails, np.abs((x - 0.25) * 0.6 + (z + 0.55) * 0.8) - 0.03)  # flatten into cloth
    knot = smin(knot, tails, 0.04)
    return smin(shell, knot, 0.03)


def neck(p):
    # dark inner neck so the open bottom of the bandana is never hollow
    return capsule_tapered(p, vec(0, -0.70, -0.14), vec(0, -1.80, 0.0), 0.26, 0.40)


# ---------------------------------------------------------------- analytic parts (exact UVs, no stair-stepping)
def analytic_patch():
    patch(np.zeros((1, 3), np.float32))   # initialises _PATCH centre/tilt from the cap surface
    c, tilt = _PATCH['c'], _PATCH['tilt']
    hw, hh, th, R = 0.115, 0.078, 0.006, 0.85
    nu, nv = 48, 32
    us, vs = np.linspace(-hw, hw, nu), np.linspace(-hh, hh, nv)
    U, V = np.meshgrid(us, vs, indexing='ij')
    bend = -(U ** 2 + V ** 2) / (2 * R)
    verts, uvs, faces = [], [], []

    def add_grid(wsign):
        base = len(verts)
        W = bend + wsign * th
        loc = np.stack([U, V, W], -1).reshape(-1, 3).astype(np.float32)
        world = rot_x(loc, -tilt) + c
        verts.extend(world.tolist())
        uvs.extend(np.stack([U / (2 * hw) + 0.5, V / (2 * hh) + 0.5], -1).reshape(-1, 2).tolist())
        for i in range(nu - 1):
            for j in range(nv - 1):
                a, b, cc, d = base + i * nv + j, base + (i + 1) * nv + j, base + (i + 1) * nv + j + 1, base + i * nv + j + 1
                faces.extend([[a, b, cc], [a, cc, d]] if wsign > 0 else [[a, cc, b], [a, d, cc]])
        return base

    f0 = add_grid(+1)
    b0 = add_grid(-1)
    ring = [(i, 0) for i in range(nu)] + [(nu - 1, j) for j in range(1, nv)]
    ring += [(i, nv - 1) for i in range(nu - 2, -1, -1)] + [(0, j) for j in range(nv - 2, 0, -1)]
    for k in range(len(ring)):
        (i0, j0), (i1, j1) = ring[k], ring[(k + 1) % len(ring)]
        a, b = f0 + i0 * nv + j0, f0 + i1 * nv + j1
        c2, d2 = b0 + i1 * nv + j1, b0 + i0 * nv + j0
        faces.extend([[a, d2, c2], [a, c2, b]])
    return np.array(verts, np.float32), np.array(faces, np.int32), np.array(uvs, np.float32)


def analytic_lenses():
    verts, faces = [], []
    for side in (-1, 1):
        nx, ny = 140, 90
        xs = np.linspace(0.305 - 0.25, 0.305 + 0.25, nx) * side
        ys = np.linspace(-0.155, 0.155, ny)
        Xg, Yg = np.meshgrid(xs, ys, indexing='ij')
        inside = lens_2d(Xg, Yg) < 0.010
        for off, front in ((0.0105, True), (-0.002, False)):
            base = len(verts)
            Z = glasses_zc(Xg) + off
            verts.extend(np.stack([Xg, Yg, Z], -1).reshape(-1, 3).tolist())
            for i in range(nx - 1):
                for j in range(ny - 1):
                    if inside[i, j] and inside[i + 1, j] and inside[i + 1, j + 1] and inside[i, j + 1]:
                        a, b, c, d = base + i * ny + j, base + (i + 1) * ny + j, base + (i + 1) * ny + j + 1, base + i * ny + j + 1
                        ccw = (side > 0) == front
                        faces.extend([[a, b, c], [a, c, d]] if ccw else [[a, c, b], [a, d, c]])
    v = np.array(verts, np.float32)
    f = np.array(faces, np.int32)
    used = np.unique(f)
    remap = -np.ones(len(v), np.int32)
    remap[used] = np.arange(len(used))
    return v[used], remap[f], None


ANALYTIC = {'patch': analytic_patch, 'lenses': analytic_lenses}


# ---------------------------------------------------------------- meshing
def mesh_sdf(fn, lo, hi, voxel, chunk=40):
    lo, hi = np.array(lo, np.float32), np.array(hi, np.float32)
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    xs = lo[0] + np.arange(n[0], dtype=np.float32) * voxel
    ys = lo[1] + np.arange(n[1], dtype=np.float32) * voxel
    zs = lo[2] + np.arange(n[2], dtype=np.float32) * voxel
    vol = np.empty(n, dtype=np.float32)
    Yg, Zg = np.meshgrid(ys, zs, indexing='ij')
    for i0 in range(0, n[0], chunk):
        i1 = min(n[0], i0 + chunk)
        Xc = xs[i0:i1][:, None, None]
        P = np.empty((i1 - i0, n[1], n[2], 3), dtype=np.float32)
        P[..., 0] = Xc
        P[..., 1] = Yg[None]
        P[..., 2] = Zg[None]
        vol[i0:i1] = fn(P)
    verts, faces, normals, _ = marching_cubes(vol, level=0.0, spacing=(voxel, voxel, voxel))
    verts += lo
    return verts.astype(np.float32), faces.astype(np.int32)


def write_obj(path, verts, faces, uvs=None, reverse=True):
    order = [0, 2, 1] if reverse else [0, 1, 2]
    with open(path, 'w', encoding='ascii') as fh:
        fh.write('# BANDRIP mascot part\n')
        np.savetxt(fh, verts, fmt='v %.5f %.5f %.5f')
        f = faces[:, order] + 1
        if uvs is not None:
            np.savetxt(fh, uvs, fmt='vt %.5f %.5f')
            np.savetxt(fh, np.stack([f[:, 0], f[:, 0], f[:, 1], f[:, 1], f[:, 2], f[:, 2]], 1), fmt='f %d/%d %d/%d %d/%d')
        else:
            np.savetxt(fh, f, fmt='f %d %d %d')


def uv_bandana(v):
    th = np.arctan2(v[:, 0], v[:, 2] + 0.05)
    return np.stack([(th + np.pi) / (2 * np.pi) * 3.0, (v[:, 1] + 1.9) * 1.6], 1)


def uv_planar_front(v, cx, cy, sx, sy):
    return np.stack([(v[:, 0] - cx) / sx + 0.5, (v[:, 1] - cy) / sy + 0.5], 1)


PARTS = {
    'skull': (skull, (-0.80, -1.20, -1.10), (0.80, 1.20, 0.92), 0.0068, None),
    'cap': (cap, (-0.88, 0.0, -1.15), (0.88, 1.28, 1.52), 0.0062, None),
    'patch': (patch, (-0.15, 0.48, 0.70), (0.15, 0.72, 1.02), 0.0022, lambda v: uv_planar_front(v, 0, 0.60, 0.25, 0.18)),
    'glasses': (glasses_frame, (-0.74, -0.18, -0.12), (0.74, 0.22, 0.96), 0.0036, None),
    'lenses': (glasses_lens, (-0.55, -0.16, 0.64), (0.55, 0.16, 0.95), 0.0020, None),
    'teeth': (teeth, (-0.42, -0.86, 0.22), (0.42, -0.53, 0.72), 0.0021, None),
    'bandana': (bandana, (-0.66, -1.82, -0.80), (0.66, -0.58, 0.88), 0.0062, uv_bandana),
    'neck': (neck, (-0.5, -1.85, -0.6), (0.5, -0.6, 0.45), 0.012, None),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    names = sys.argv[1:] or list(PARTS)
    for name in names:
        t = time.time()
        if name in ANALYTIC:
            v, f, uvs = ANALYTIC[name]()
            write_obj(OUT / f'{name}.obj', v, f, uvs, reverse=False)
        else:
            fn, lo, hi, vox, uvf = PARTS[name]
            v, f = mesh_sdf(fn, lo, hi, vox)
            uvs = uvf(v) if uvf else None
            write_obj(OUT / f'{name}.obj', v, f, uvs)
        print(f'{name}: {len(v)} verts {len(f)} tris {time.time() - t:.1f}s')


if __name__ == '__main__':
    main()
