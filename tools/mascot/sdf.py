"""Small numpy signed-distance-field toolkit used to sculpt the BANDRIP mascot.

All functions take p with shape (..., 3) and return distances with shape (...).
Smooth operators use the polynomial smooth-min formulation.
"""

import numpy as np


def length(v):
    return np.sqrt(np.sum(v * v, axis=-1))


def vec(*a):
    return np.array(a, dtype=np.float32)


def sphere(p, c, r):
    return length(p - c) - r


def ellipsoid(p, c, r):
    q = (p - c) / r
    k0 = length(q)
    k1 = length((p - c) / (r * r))
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def capsule(p, a, b, r):
    pa = p - a
    ba = b - a
    h = np.clip(np.sum(pa * ba, axis=-1) / np.dot(ba, ba), 0.0, 1.0)
    return length(pa - ba * h[..., None]) - r


def capsule_tapered(p, a, b, ra, rb):
    pa = p - a
    ba = b - a
    h = np.clip(np.sum(pa * ba, axis=-1) / np.dot(ba, ba), 0.0, 1.0)
    return length(pa - ba * h[..., None]) - (ra + (rb - ra) * h)


def round_box(p, c, b, r):
    q = np.abs(p - c) - (b - r)
    return length(np.maximum(q, 0.0)) + np.minimum(np.max(q, axis=-1), 0.0) - r


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def ssub(a, b, k):
    """Smoothly subtract b from a."""
    return smax(a, -b, k)


def rot_x(p, ang):
    c, s = np.cos(ang), np.sin(ang)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    return np.stack([x, c * y - s * z, s * y + c * z], axis=-1)


def rot_y(p, ang):
    c, s = np.cos(ang), np.sin(ang)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    return np.stack([c * x + s * z, y, -s * x + c * z], axis=-1)


def rot_z(p, ang):
    c, s = np.cos(ang), np.sin(ang)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    return np.stack([c * x - s * y, s * x + c * y, z], axis=-1)


def mirror_x(p):
    q = p.copy()
    q[..., 0] = np.abs(q[..., 0])
    return q


def round_rect_2d(x, y, hw, hh, r):
    qx = np.abs(x) - (hw - r)
    qy = np.abs(y) - (hh - r)
    return np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2) + np.minimum(np.maximum(qx, qy), 0) - r


def ellipse_2d(x, y, a, b):
    """Approximate signed distance to an axis-aligned ellipse (good near the boundary)."""
    k0 = np.sqrt((x / a) ** 2 + (y / b) ** 2)
    k1 = np.sqrt((x / (a * a)) ** 2 + (y / (b * b)) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def value_noise3(p, freq, seed=0):
    """Cheap smooth pseudo-noise from summed sines (deterministic)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(p.shape[:-1], dtype=np.float32)
    for _ in range(4):
        d = rng.normal(size=3)
        d /= np.linalg.norm(d)
        ph = rng.uniform(0, 6.283)
        f = freq * rng.uniform(0.7, 1.4)
        out += np.sin(np.sum(p * d, axis=-1) * f + ph)
    return out / 4.0
