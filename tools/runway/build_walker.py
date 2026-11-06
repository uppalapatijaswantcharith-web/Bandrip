"""Runway mannequin: faceless figure in BANDRIP streetwear, sculpted as one SDF (A-pose).

Run: python tools/runway/build_walker.py
Writes assets_src/runway/walker.obj with material groups (skin, tee, pants, shoes, cap)
for tools/runway/blender_walker.py (armature, weights, walk cycle, export).
Units are metres; feet on y=0; facing +Z; +X is the figure's left.
"""

import sys
import time
from pathlib import Path

import numpy as np
from skimage.measure import marching_cubes

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'mascot'))
from sdf import capsule, capsule_tapered, ellipsoid, mirror_x, round_box, smin, smax, value_noise3, vec  # noqa: E402

OUT = HERE.parents[1] / 'assets_src' / 'runway'

from joints import J  # noqa: E402


def V(k):
    return vec(*J[k])


def parts(p):
    pm = mirror_x(p)
    # mannequin body (visible: head, neck, forearms, hands)
    head = ellipsoid(p, vec(0, 1.675, 0.012), vec(0.083, 0.112, 0.098))
    head = smin(head, ellipsoid(p, vec(0, 1.615, 0.045), vec(0.055, 0.05, 0.06)), 0.03)   # jaw mass
    neck = capsule(p, vec(0, 1.47, 0), vec(0, 1.60, 0.012), 0.046)
    fore = capsule_tapered(pm, V('elbow'), V('wrist'), 0.040, 0.030)
    hand = ellipsoid(pm, V('hand'), vec(0.024, 0.075, 0.046))
    hand = smin(hand, capsule(pm, vec(0.355, 0.82, 0.055), vec(0.36, 0.77, 0.075), 0.014), 0.012)  # thumb
    skin = smin(smin(head, neck, 0.03), smin(fore, hand, 0.03), 0.02)
    # oversized tee: boxy body, drop shoulders, wide sleeves to the elbow
    tee = round_box(p, vec(0, 1.19, 0.0), vec(0.235, 0.275, 0.145), 0.075)
    tee = smin(tee, capsule_tapered(pm, vec(0.20, 1.40, -0.005), vec(0.29, 1.16, -0.005), 0.085, 0.075), 0.05)
    tee = smax(tee, -(p[..., 1] - 0.87), 0.02)           # hem
    tee = tee + 0.006 * value_noise3(p, 18.0, seed=2) * (p[..., 1] < 1.1)   # drape ripples near the hem
    # wide cargo pants with thigh pockets
    waist = ellipsoid(p, vec(0, 0.94, 0), vec(0.18, 0.10, 0.125))
    # legs: deep (front-back) wide sections, kept apart by a carved inseam so they never web together
    lq = pm * np.array([1.0, 1.0, 0.82], np.float32)
    leg = capsule_tapered(lq, vec(0.118, 0.90, 0.0), vec(0.122, 0.10, 0.0), 0.097, 0.104)
    pocket = round_box(pm, vec(0.215, 0.60, 0.0), vec(0.03, 0.085, 0.075), 0.026)
    pants = smin(smin(waist, leg, 0.05), pocket, 0.02)
    pants = smax(pants, -np.maximum(np.abs(p[..., 0]) - 0.016, p[..., 1] - 0.80), 0.014)
    pants = smax(pants, -(p[..., 1] - 0.075), 0.01)
    pants = pants + 0.005 * value_noise3(p, 14.0, seed=8)
    # chunky sneakers
    shoe = round_box(pm, vec(0.105, 0.055, 0.045), vec(0.055, 0.055, 0.14), 0.045)
    sole = round_box(pm, vec(0.105, 0.018, 0.048), vec(0.062, 0.018, 0.15), 0.014)
    shoes = smin(shoe, sole, 0.01)
    # cap
    crown = ellipsoid(p, vec(0, 1.705, 0.0), vec(0.098, 0.088, 0.112))
    crown = smax(crown, -(p[..., 1] - 1.70 - 0.08 * (p[..., 2] - 0.0)), 0.01)
    brim_d = ellipsoid(p, vec(0, 1.708, 0.12), vec(0.088, 0.008, 0.075))
    cap = smin(crown, brim_d, 0.01)
    return {'skin': skin, 'tee': tee, 'pants': pants, 'shoes': shoes, 'cap': cap}


def walker(p):
    pr = parts(p)
    d = pr['skin']
    for k in ('tee', 'pants', 'shoes', 'cap'):
        d = smin(d, pr[k], 0.008)
    return d


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    t = time.time()
    lo, hi, vox = np.array([-0.45, -0.01, -0.22], np.float32), np.array([0.45, 1.83, 0.30], np.float32), 0.0052
    n = np.ceil((hi - lo) / vox).astype(int) + 1
    xs, ys, zs = (lo[i] + np.arange(n[i], dtype=np.float32) * vox for i in range(3))
    vol = np.empty(n, np.float32)
    Yg, Zg = np.meshgrid(ys, zs, indexing='ij')
    for i0 in range(0, n[0], 30):
        i1 = min(n[0], i0 + 30)
        P = np.empty((i1 - i0, n[1], n[2], 3), np.float32)
        P[..., 0] = xs[i0:i1][:, None, None]
        P[..., 1] = Yg[None]
        P[..., 2] = Zg[None]
        vol[i0:i1] = walker(P)
    verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(vox, vox, vox))
    verts = (verts + lo).astype(np.float32)
    # label faces by the nearest garment component at the face centre
    cen = verts[faces].mean(axis=1)
    pr = parts(cen[None, None, :, :].reshape(-1, 3))
    names = list(pr)
    lab = np.argmin(np.stack([pr[k] for k in names], 0), axis=0)
    with open(OUT / 'walker.obj', 'w', encoding='ascii') as fh:
        fh.write('# BANDRIP runway mannequin\n')
        np.savetxt(fh, verts, fmt='v %.5f %.5f %.5f')
        for li, name in enumerate(names):
            fh.write(f'usemtl {name}\n')
            np.savetxt(fh, faces[lab == li][:, [0, 2, 1]] + 1, fmt='f %d %d %d')
    print(f'walker: {len(verts)} verts {len(faces)} tris {time.time() - t:.1f}s', {k: int((lab == i).sum()) for i, k in enumerate(names)})


if __name__ == '__main__':
    main()
