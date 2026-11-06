"""Blender headless finish for the depot garments (reuses the mascot pipeline helpers).

blender --background --factory-startup --python tools/depot/blender_depot.py -- [--fast]
"""

import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'mascot'))
import blender_finish as bf  # noqa: E402

SRC = HERE.parents[1] / 'assets_src' / 'depot'
OUT = HERE.parents[1] / 'static' / 'models' / 'depot.glb'
FAST = '--fast' in sys.argv
bf.BAKE = SRC / 'baked'
SIZE = 256 if FAST else 1024


def image_cotton(name, image, tint=None):
    mat, N, bsdf = bf.new_material(name)
    uv = N.new('ShaderNodeUVMap', uv_map='UVMap')
    img = N.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(str(image))
    N.link(uv.outputs['UV'], img.inputs['Vector'])
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    c = N.mix(N.math('MULTIPLY', N.noise(co, 8.0, 5), 0.12), img.outputs['Color'], tint or bf.srgb('#CFC9BC'))
    ao = N.new('ShaderNodeAmbientOcclusion', samples=16, in_Distance=0.05)
    grime = N.ramp(ao.outputs['AO'], [(0.4, (1, 1, 1, 1)), (0.95, (0, 0, 0, 1))])
    c = N.mix(N.math('MULTIPLY', grime.outputs['Color'], 0.45), c, (0.0, 0.0, 0.0, 1.0))
    N.link(c, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    nrm = N.bump(N.noise(co, 160.0, 3), 0.14, 0.0015)
    N.link(nrm, bsdf.inputs['Normal'])
    return mat


def main():
    bf.clear_scene()
    spec = {
        'tee': ('img', SRC / 'tee_print.png'),
        'shirt': ('cot', ('#C8342B', '#7E1C16')),
        'jacket': ('cot', ('#1C1C1C', '#0A0A0A')),
        'pants': ('cot', ('#8E887A', '#5B5649')),
        'bandana': ('img', bf.SRC / 'bandana.png'),
    }
    for name, (kind, arg) in spec.items():
        bpy.ops.wm.obj_import(filepath=str(SRC / f'{name}.obj'), forward_axis='NEGATIVE_Z', up_axis='Y')
        ob = bpy.context.selected_objects[0]
        ob.name = ob.data.name = name
        bf.clean_and_decimate(ob, 34000)
        mat = image_cotton(f'{name}_proc', arg) if kind == 'img' else bf.cotton_material(f'{name}_proc', *arg, rough=0.84)
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    bf.setup_cycles()
    # bake each garment on its own so neighbours do not occlude it
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    for ob in objs:
        for other in objs:
            other.hide_render = other is not ob
        bf.unwrap(ob)
        alb, rgh, nrm = bf.bake_object(ob, SIZE, ao_strength=0.85)
        final = bf.baked_material(ob.name, alb, rgh, nrm)
        ob.data.materials.clear()
        ob.data.materials.append(final)
        ob.data.uv_layers.remove(ob.data.uv_layers['UVMap'])
        ob.data.uv_layers['bake'].name = 'UVMap'
    for ob in objs:
        ob.hide_render = False
    # lay them out for a preview render
    for i, ob in enumerate(objs):
        ob.location.x = (i - 2) * 1.9
    bf.setup_lights()
    bf.SRC = SRC
    bf.render_view('lineup', (0, -9.5, 0.4), target=(0, 0, 0), lens=40, res=(1800, 700))
    for ob in objs:
        ob.location.x = 0
    bf.export_glb(OUT)


main()
