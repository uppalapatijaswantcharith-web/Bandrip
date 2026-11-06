import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'mascot'))
import blender_finish as bf
OUT = ROOT / 'assets_src' / 'user_glb'
for name in ['hoodie', 'crew', 'skater', 'spraycan']:
    bf.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'static' / 'models' / f'{name}.glb'))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr, size = (lo + hi) / 2, hi - lo
    bf.setup_cycles(24); bf.setup_lights()
    for l in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        l.location = ctr + (l.location / 3.0) * max(size)
    d = max(size) * 2.3
    bf.SRC = OUT
    bf.render_view(f'web_{name}', tuple(ctr + Vector((-d * 0.55, -d * 0.85, size.z * 0.15))), target=tuple(ctr), lens=50, res=(700, 700), samples=24)
