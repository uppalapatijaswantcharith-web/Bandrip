"""Blender: the six-panel cap and wrap sunglasses (from build_mascot.py) as a standalone accessories.glb
for the Depot's Caps and Sunglasses plinths (the logo mascot now wears the cowboy hat instead).

blender --background --factory-startup --python tools/mascot/accessories.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import blender_finish as bf  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'static' / 'models' / 'accessories.glb'

bf.clear_scene()
objs = {}
for n in ('cap', 'patch', 'glasses', 'lenses'):
    ob = bf.import_part(n)
    bf.clean_and_decimate(ob, bf.TARGETS[n])
    objs[n] = ob
cap = objs['cap']
cap.data.materials.append(bf.cotton_material('cap_proc', '#141414', '#090909'))
brim = bf.cotton_material('brim_proc', '#D4362B', '#9E2219', rough=0.82)
cap.data.materials.append(brim)
for poly in cap.data.polygons:
    web_y, web_z = poly.center.z, -poly.center.y
    if web_z > 0.80 and poly.normal.z < -0.45 and web_y < 0.27:
        poly.material_index = 1
objs['patch'].data.materials.append(bf.simple_material('patch', '#FFFFFF', 0.7, image=bf.SRC / 'patch.png'))
objs['glasses'].data.materials.append(bf.simple_material('frame', '#0D0D0D', 0.16, coat=1.0))
objs['lenses'].data.materials.append(bf.simple_material('lens', '#140C0B', 0.03, spec=1.0))
bf.setup_cycles()
bf.unwrap(cap)
alb, rgh, nrm = bf.bake_object(cap, 1024, ao_strength=0.9)
cap.data.materials.clear()
cap.data.materials.append(bf.baked_material('cap', alb, rgh, nrm))
cap.data.uv_layers['bake'].name = 'UVMap'
bf.export_glb(OUT)
