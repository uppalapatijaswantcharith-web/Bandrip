import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'mascot'))
import blender_finish as bf
SRC = ROOT / 'assets_src' / 'user_glb'
for name in ['cowboy_hat', 'bandana_mask']:
    bf.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC / f'{name}.glb'))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        print(name, o.name, 'matrix_world scale', [round(v, 3) for v in o.matrix_world.to_scale()], flush=True)
        for n in o.active_material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                n.image.filepath_raw = str(SRC / f'tex_{name}_{n.image.name}.png'); n.image.file_format = 'PNG'; n.image.save()
                print('  tex', n.image.name, n.image.size[:], [l.to_socket.name for l in n.outputs['Color'].links], flush=True)
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr, size = (lo + hi) / 2, hi - lo
    print(name, 'world size', [round(v, 3) for v in size], 'center', [round(v, 3) for v in ctr], flush=True)
    bf.setup_cycles(24); bf.setup_lights()
    for l in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        l.location = ctr + (l.location / 3.0) * max(size)
    d = max(size) * 2.3
    bf.SRC = SRC
    bf.render_view(f'{name}_a', tuple(ctr + Vector((0, -d, size.z * 0.3))), target=tuple(ctr), lens=50, res=(600, 600), samples=24)
    bf.render_view(f'{name}_b', tuple(ctr + Vector((-d * 0.8, -d * 0.6, size.z * 0.5))), target=tuple(ctr), lens=50, res=(600, 600), samples=24)
