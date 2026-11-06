"""Logo-accurate mascot: sculpted skull + client-supplied cowboy hat and bandana mask (CC BY 4.0).

blender --background --factory-startup --python tools/mascot/assemble_logo.py -- [--preview]

Skull, teeth and neck come from build_mascot.py. The hat (MadeByYeshe) is recoloured to black felt
and seated low on the brow, cocked like the logo. The bandana mask (Tactical_Gamer) is subdivided and
shrink-wrapped *outside* the skull so it drapes over the real cheekbones and jaw. Skull/teeth are then
baked with the hat and bandana present so their contact shadows land in the textures.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import blender_finish as bf  # noqa: E402

ROOT = HERE.parents[1]
UG = ROOT / 'assets_src' / 'user_glb'
PREVIEW = '--preview' in sys.argv

# placement (Blender frame: face looks -Y, up is +Z; skull spans z -1.2..1.15)
HAT = dict(scale=10.2, loc=(0.0, 0.06, 0.40), rot=(-14.0, 7.0, 0.0), yaw=0.0)
BANDANA = dict(scale=0.95, loc=(0.0, -0.06, -0.88), rot=(0.0, 0.0, 0.0), wrap_offset=0.025)


def import_glb_joined(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    for o in new:
        if o.type == 'EMPTY' and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.name = ob.data.name = name
    # centre on its own bounds
    pts = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return ob, lo, hi


def place(ob, lo, hi, cfg, base='bottom'):
    """Origin to bottom-centre (hat) or centre (bandana), then scale/rotate/move."""
    pivot = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z if base == 'bottom' else (lo.z + hi.z) / 2))
    ob.data.transform(__import__('mathutils').Matrix.Translation(-pivot))
    ob.scale = (cfg['scale'],) * 3
    r = cfg['rot']
    ob.rotation_euler = Euler((math.radians(r[0]), math.radians(r[1]), math.radians(r[2] + cfg.get('yaw', 0.0))), 'XYZ')
    ob.location = cfg['loc']
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def felt_material(ob):
    """Recolour the hat to black felt; keep its normal/roughness maps."""
    m = ob.active_material
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    link = bsdf.inputs['Base Color'].links[0] if bsdf.inputs['Base Color'].links else None
    if link:
        tex_out = link.from_socket
        nt.links.remove(link)
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        ins = [i for i in mix.inputs if i.type == 'RGBA']
        nt.links.new(tex_out, ins[0])
        ins[1].default_value = bf.srgb('#1E1A17')
        nt.links.new([o for o in mix.outputs if o.type == 'RGBA'][0], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = bf.srgb('#1E1A17')
    bsdf.inputs['Roughness'].default_value = 0.82
    m.name = 'hat'


def main():
    bf.clear_scene()
    parts = {}
    for n in ('skull', 'teeth', 'neck'):
        ob = bf.import_part(n)
        bf.clean_and_decimate(ob, bf.TARGETS[n])
        parts[n] = ob
    hat, lo, hi = import_glb_joined(UG / 'cowboy_hat.glb', 'hat')
    place(hat, lo, hi, HAT, 'bottom')
    felt_material(hat)
    band, lo, hi = import_glb_joined(UG / 'bandana_mask.glb', 'bandana')
    place(band, lo, hi, BANDANA, 'centre')
    band.active_material.name = 'bandana'
    sub = band.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    # drape: anything inside the skull/neck is pushed to just outside the surface
    for target in (parts['skull'], parts['neck']):
        sw = band.modifiers.new(f'wrap_{target.name}', 'SHRINKWRAP')
        sw.target = target
        sw.wrap_method = 'NEAREST_SURFACEPOINT'
        sw.wrap_mode = 'OUTSIDE'
        sw.offset = BANDANA['wrap_offset']
    sm = band.modifiers.new('relax', 'CORRECTIVE_SMOOTH')
    sm.factor = 0.5
    sm.iterations = 4
    bpy.context.view_layer.objects.active = band
    for mod in list(band.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth()

    proc = {'skull': bf.bone_material(), 'teeth': bf.enamel_material()}
    for n, mat in proc.items():
        parts[n].data.materials.clear()
        parts[n].data.materials.append(mat)
    parts['neck'].data.materials.clear()
    parts['neck'].data.materials.append(bf.simple_material('neck', '#191615', 0.9))
    bf.setup_cycles()
    if not PREVIEW:
        for n in ('skull', 'teeth'):
            ob = parts[n]
            bf.unwrap(ob)
            alb, rgh, nrm = bf.bake_object(ob, bf.BAKE_SIZE[n], ao_strength=0.9 if n == 'skull' else 0.75)
            ob.data.materials.clear()
            ob.data.materials.append(bf.baked_material(n, alb, rgh, nrm, sss=0.12))
            ob.data.uv_layers.remove(ob.data.uv_layers['UVMap']) if 'UVMap' in ob.data.uv_layers and len(ob.data.uv_layers) > 1 else None
            ob.data.uv_layers['bake'].name = 'UVMap'
    bf.setup_lights()
    bf.SRC = bf.SRC  # previews next to the other mascot previews
    bf.render_view('logo_three_quarter', (-3.4, -5.0, 0.6), samples=32 if PREVIEW else 96)
    bf.render_view('logo_front', (0.0, -6.4, 0.2), samples=32 if PREVIEW else 96)
    bf.render_view('logo_profile', (-6.3, -0.6, 0.3), samples=32 if PREVIEW else 96)
    if not PREVIEW:
        bf.export_glb()


main()
