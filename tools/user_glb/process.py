"""Blender: turn the client-supplied Sketchfab GLBs (CC BY 4.0) into web assets.

blender --background --factory-startup --python tools/user_glb/process.py -- [hoodie] [crew] [skater]

hoodie : Sp5der decals removed, jersey recoloured to BANDRIP ink, decimated     -> static/models/hoodie.glb
crew   : 712k-tri scan baked (normal + AO) onto a 40k low-poly concrete statue  -> static/models/crew.glb
skater : decimated, recoloured to the BANDRIP palette                           -> static/models/skater.glb
"""

import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'user_glb'
MODELS = ROOT / 'static' / 'models'
sys.path.insert(0, str(ROOT / 'tools' / 'mascot'))
import blender_finish as bf  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['hoodie', 'crew', 'skater']


def import_glb(name):
    bf.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC / f'{name}.glb'))
    return [o for o in bpy.data.objects if o.type == 'MESH']


def apply_all_transforms(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def drop_empties():
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def normalise(objs, height=1.0, ground=True):
    """Scale to `height` (Blender Z), centre on X/Y, feet on Z=0."""
    lo, hi = bounds(objs)
    k = height / (hi.z - lo.z)
    ctr = (lo + hi) / 2
    for o in objs:
        o.location = (o.location - Vector((ctr.x, ctr.y, lo.z if ground else ctr.z))) * k
        o.scale = o.scale * k
    apply_all_transforms(objs)


def hoodie():
    objs = import_glb('sp5der_pnk_hoodie')
    apply_all_transforms(objs)
    drop_empties()
    body = max(objs, key=lambda o: len(o.data.polygons))
    for o in objs:
        if o is not body:
            bpy.data.objects.remove(o)      # Sp5der print decals: removed entirely
    body.name = body.data.name = 'hoodie'
    normalise([body], 1.0, ground=False)
    bf.clean_and_decimate(body, 42000)
    # recolour the jersey knit to BANDRIP ink, keep the weave
    img = next(n.image for n in body.active_material.node_tree.nodes if n.type == 'TEX_IMAGE')
    px = np.empty(len(img.pixels), np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lum = px[:, :3].mean(1, keepdims=True)
    lum = (lum - lum.mean()) * 2.2 + 0.5
    px[:, :3] = np.clip(0.055 + (lum - 0.5) * 0.10, 0, 1) * np.array([1.0, 0.98, 0.96], np.float32)
    new = bpy.data.images.new('hoodie_jersey', img.size[0] // 4, img.size[1] // 4)
    small = px.reshape(img.size[1], img.size[0], 4)[::4, ::4].copy()
    new.pixels.foreach_set(small.ravel())
    mat, N, bsdf = bf.new_material('hoodie')
    t = N.new('ShaderNodeTexImage')
    t.image = new
    N.link(t.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.92
    body.data.materials.clear()
    body.data.materials.append(mat)
    bf.export_glb(MODELS / 'hoodie.glb')


def crew():
    objs = import_glb('v0_street_basketball_team_fashion_characters')
    apply_all_transforms(objs)
    drop_empties()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    high = bpy.context.active_object
    high.name = 'crew_high'
    normalise([high], 1.0)
    bpy.ops.object.duplicate()
    low = bpy.context.active_object
    low.name = low.data.name = 'crew'
    bf.clean_and_decimate(low, 90000)
    # concrete statue material for the albedo bake: CC0 concrete, box-projected, plus AO grime
    mat, N, bsdf = bf.new_material('crew_concrete')
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (2.2, 2.2, 2.2)
    N.link(co, mp.inputs['Vector'])
    tex = N.new('ShaderNodeTexImage', projection='BOX', projection_blend=0.25)
    tex.image = bpy.data.images.load(str(ROOT / 'assets_src' / 'cc0' / 'concrete_wall_003_diff_1k.jpg'))
    N.link(mp.outputs['Vector'], tex.inputs['Vector'])
    c = N.mix(0.45, tex.outputs['Color'], bf.srgb('#BDB8AE'))
    N.link(c, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    low.data.materials.clear()
    low.data.materials.append(mat)
    bf.setup_cycles()
    bf.unwrap(low)
    low.data.uv_layers.active = low.data.uv_layers['bake']
    size = 2048
    sc = bpy.context.scene
    # the scan has overlapping/inverted shells, so a high->low normal bake is unreliable;
    # keep more real geometry instead and bake albedo/AO on the low-poly alone
    # albedo + AO on the low-poly (scan hidden so it does not occlude)
    sc.render.bake.use_selected_to_active = False
    high.hide_render = True
    alb, rgh, _ = bf.bake_object(low, size, ao_strength=0.6)
    final = bf.baked_material('crew', alb, rgh, _)
    low.data.materials.clear()
    low.data.materials.append(final)
    bpy.data.objects.remove(high)
    for uv in [u.name for u in low.data.uv_layers if u.name != 'bake']:
        low.data.uv_layers.remove(low.data.uv_layers[uv])
    low.data.uv_layers['bake'].name = 'UVMap'
    bf.export_glb(MODELS / 'crew.glb')


def skater():
    objs = import_glb('mishu')
    apply_all_transforms(objs)
    drop_empties()
    normalise(objs, 1.0)
    total = sum(len(o.data.polygons) for o in objs)
    for o in objs:
        bf.clean_and_decimate(o, max(300, int(len(o.data.polygons) * 46000 / total)))
    palette = {'Jacket': '#E63228', 'Legs': '#2A2927', 'Shoes': '#F2F0E9', 'Skateboard': '#E4DCCB', 'Hair': '#151515',
               'Chain': '#C9C6C0', 'Necklace': '#C9C6C0', 'Earring': '#C9C6C0'}
    for m in bpy.data.materials:
        key = next((k for k in palette if m.name.startswith(k)), None)
        if key and m.use_nodes:
            b = m.node_tree.nodes.get('Principled BSDF')
            if b:
                for l in list(b.inputs['Base Color'].links):
                    m.node_tree.links.remove(l)
                b.inputs['Base Color'].default_value = bf.srgb(palette[key])
                if key in ('Chain', 'Necklace', 'Earring'):
                    b.inputs['Metallic'].default_value = 1.0
                    b.inputs['Roughness'].default_value = 0.25
    bf.export_glb(MODELS / 'skater.glb')


for job in ARGS:
    {'hoodie': hoodie, 'crew': crew, 'skater': skater}[job]()
