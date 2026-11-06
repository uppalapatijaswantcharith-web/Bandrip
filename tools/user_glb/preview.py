"""Blender: import each user GLB and render a framed preview (front + 3/4)."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'user_glb'
sys.path.insert(0, str(ROOT / 'tools' / 'mascot'))
import blender_finish as bf  # noqa: E402

for name in ['mishu', 'sp5der_pnk_hoodie', 'v0_street_basketball_team_fashion_characters']:
    bf.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC / f'{name}.glb'))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr, size = (lo + hi) / 2, (hi - lo)
    print(name, 'size', [round(v, 3) for v in size], 'center', [round(v, 3) for v in ctr], 'meshes', len(meshes), flush=True)
    bf.setup_cycles(24)
    bf.setup_lights()
    for l in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        l.location = ctr + (l.location / 3.0) * max(size)
    d = max(size) * 2.2
    bf.SRC = SRC
    bf.render_view(f'{name}_front', tuple(ctr + Vector((0, -d, size.z * 0.1))), target=tuple(ctr), lens=50, res=(800, 800), samples=24)
    bf.render_view(f'{name}_34', tuple(ctr + Vector((-d * 0.7, -d * 0.7, size.z * 0.2))), target=tuple(ctr), lens=50, res=(800, 800), samples=24)
