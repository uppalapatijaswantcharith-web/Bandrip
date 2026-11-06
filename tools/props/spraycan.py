"""BANDRIP aerosol can: lathed profile, printed label, metal rims, actuator. Blender 5.x headless.

1) python tools/props/spraycan.py --label      (writes the label texture with PIL)
2) blender --background --factory-startup --python tools/props/spraycan.py   (model, renders, GLB)
"""

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'props'
LABEL = SRC / 'spraycan_label.png'


def make_label():
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
    S = 2048
    img = Image.new('RGB', (S, S), (230, 50, 40))
    d = ImageDraw.Draw(img)
    fonts = ROOT / 'assets_src' / 'fonts'
    # v (image y) runs top->bottom = can top->bottom. Body spans ~ y 450..1940.
    band_top, band_bot = 760, 1600
    d.rectangle([0, band_top, S, band_bot], fill=(21, 21, 21))
    for y in (band_top - 26, band_bot + 14):
        d.rectangle([0, y, S, y + 12], fill=(242, 240, 233))
    piece = Image.open(ROOT / 'assets_src' / 'graffiti' / 'piece_bandrip.png').convert('RGBA')
    piece.thumbnail((900, 420))
    for cx in (S * 0.25, S * 0.75):     # front and back of the can
        img.paste(piece, (int(cx - piece.width / 2), int((band_top + band_bot) / 2 - piece.height / 2 - 40)), piece)
    mono = ImageFont.truetype(str(fonts / 'SpaceMono-Bold.ttf'), 46)
    anton = ImageFont.truetype(str(fonts / 'Anton-Regular.ttf'), 120)
    for cx in (S * 0.25, S * 0.75):
        for i, line in enumerate(['STREET PAINT · SIGNAL RED', 'HIGH PRESSURE · 400 ML · DROP_01']):
            tb = d.textbbox((0, 0), line, font=mono)
            d.text((cx - (tb[2] - tb[0]) / 2, band_bot - 150 + i * 60), line, font=mono, fill=(242, 240, 233))
    d.text((S * 0.47, band_top + 60), 'B', font=anton, fill=(230, 50, 40))
    d.text((S * 0.97, band_top + 60), 'B', font=anton, fill=(230, 50, 40))
    small = ImageFont.truetype(str(fonts / 'SpaceMono-Bold.ttf'), 28)
    for k in range(6):
        d.text((S * 0.40 + k * 4, 520 + k * 34), 'SHAKE WELL · HOLD 20 CM · SPRAY IN LIGHT COATS'[: 18 + k * 4], font=small, fill=(21, 21, 21))
    # paint drips running down from the shoulder over the label
    rng = np.random.default_rng(3)
    for _ in range(26):
        x = rng.uniform(0, S)
        L = rng.uniform(80, 720) ** 1.0
        w = rng.uniform(10, 26)
        d.rounded_rectangle([x - w / 2, 300, x + w / 2, 430 + L], radius=int(w / 2), fill=(214, 40, 32))
        d.ellipse([x - w * 0.75, 430 + L - w * 0.75, x + w * 0.75, 430 + L + w * 0.75], fill=(214, 40, 32))
    # wear: scratches
    for _ in range(140):
        x, y = rng.uniform(0, S), rng.uniform(400, 1950)
        L = rng.uniform(10, 60)
        a = rng.uniform(0, math.pi)
        d.line([x, y, x + L * math.cos(a), y + L * math.sin(a)], fill=(200, 196, 188), width=1)
    SRC.mkdir(parents=True, exist_ok=True)
    img.save(LABEL)
    print('label written', LABEL)


if '--label' in sys.argv:
    make_label()
    sys.exit(0)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

sys.path.insert(0, str(ROOT / 'tools' / 'mascot'))
import blender_finish as bf  # noqa: E402

OUT = ROOT / 'static' / 'models' / 'spraycan.glb'
H = 0.193

# radius/height profile (metres): bottom crimp, body, shoulder dome, neck crimp, valve cup
PROFILE = [
    (0.0, 0.0035), (0.026, 0.0035), (0.029, 0.0), (0.0318, 0.0008), (0.0332, 0.004), (0.0326, 0.0075),
    (0.0331, 0.0105), (0.0331, 0.148), (0.0322, 0.1535), (0.0298, 0.1595), (0.0258, 0.1648), (0.0205, 0.1690),
    (0.0158, 0.1712), (0.0149, 0.1720), (0.0156, 0.1738), (0.0152, 0.1768), (0.0126, 0.1778), (0.0098, 0.1781),
    (0.0094, 0.1805), (0.0, 0.1808),
]


def lathe(name, profile, segments=96):
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    uv_layer = bm.loops.layers.uv.new('UVMap')
    for k in range(len(rings) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            f = bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            for loop, (ii, kk) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                loop[uv_layer].uv = (ii / segments, profile[kk][1] / H)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def main():
    bf.clear_scene()
    can = lathe('can', PROFILE)
    # materials: printed body, bare metal rims/dome, plastic actuator
    body, N, bsdf = bf.new_material('can_body')
    tex = N.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(LABEL))
    N.link(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.35
    bsdf.inputs['Roughness'].default_value = 0.32
    bsdf.inputs['Coat Weight'].default_value = 0.6
    metal = bf.simple_material('can_metal', '#C9C6C0', 0.22)
    metal.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 1.0
    can.data.materials.append(body)
    can.data.materials.append(metal)
    for p in can.data.polygons:
        z = p.center.z
        p.material_index = 0 if 0.0105 <= z <= 0.1535 else 1
    # actuator (spray cap) with nozzle facing -Y (front)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.0102, depth=0.0135, location=(0, 0, 0.1873))
    act = bpy.context.active_object
    act.name = 'actuator'
    bev = act.modifiers.new('bev', 'BEVEL')
    bev.width = 0.0022
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier='bev')
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0021, depth=0.0035, location=(0, -0.0105, 0.1885), rotation=(math.pi / 2, 0, 0))
    nozzle = bpy.context.active_object
    nozzle.name = 'nozzle'
    plastic = bf.simple_material('can_plastic', '#151515', 0.4)
    act.data.materials.append(plastic)
    nozzle.data.materials.append(bf.simple_material('can_nozzle', '#E63228', 0.35))
    for ob in (act, nozzle):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = act
    bpy.ops.object.join()
    act.name = 'actuator'

    bf.setup_cycles(96)
    bf.setup_lights()
    for l in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        l.location = Vector(l.location) * 0.09 + Vector((0, 0, 0.1))
        l.data.energy *= 0.012
        l.data.size *= 0.09
    bf.SRC = SRC
    tgt = (0, 0, 0.1)
    bf.render_view('spraycan_34', (-0.30, -0.55, 0.24), target=tgt, lens=85, res=(900, 1400), samples=96)
    bf.render_view('spraycan_front', (0.0, -0.66, 0.12), target=tgt, lens=85, res=(900, 1400), samples=96)
    # web scale: 1 unit tall for easier use in three.js
    for ob in (can, act):
        ob.scale = (1 / H, 1 / H, 1 / H)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in (can, act):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = can
    bpy.ops.object.transform_apply(scale=True)
    bf.export_glb(OUT)


main()
