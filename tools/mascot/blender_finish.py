"""Blender 5.x headless finishing pass for the BANDRIP mascot.

blender --background --factory-startup --python tools/mascot/blender_finish.py -- [--fast]

1. Imports the SDF-sculpted OBJ parts (tools/mascot/build_mascot.py), cleans, decimates, smooths.
2. Builds procedural shaders (bone, enamel, cotton twill, printed bandana).
3. UV-unwraps and bakes them to textures on the GPU (albedo, roughness, normal, AO); albedo is
   multiplied by AO so the look survives any real-time renderer.
4. Renders Cycles previews and exports static/models/mascot.glb (Draco, WebP textures).
"""

import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'mascot'
BAKE = SRC / 'baked'
OUT_GLB = ROOT / 'static' / 'models' / 'mascot.glb'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
FAST = '--fast' in ARGS

TARGETS = {'skull': 90000, 'teeth': 26000, 'cap': 36000, 'patch': 10 ** 7, 'glasses': 24000,
           'lenses': 10 ** 7, 'bandana': 42000, 'neck': 3000}
BAKE_SIZE = {'skull': 2048, 'teeth': 1024, 'cap': 1024, 'bandana': 2048}
if FAST:
    BAKE_SIZE = {k: v // 4 for k, v in BAKE_SIZE.items()}


# ------------------------------------------------------------------ helpers
def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def import_part(name):
    bpy.ops.wm.obj_import(filepath=str(SRC / f'{name}.obj'), forward_axis='NEGATIVE_Z', up_axis='Y')
    ob = bpy.context.selected_objects[0]
    ob.name = name
    ob.data.name = name
    return ob


def activate(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def clean_and_decimate(ob, target):
    activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0003)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    faces = len(ob.data.polygons)
    if faces > target:
        mod = ob.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = target / faces
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    sm = ob.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
    sm.factor = 0.3
    sm.iterations = 2
    sm.use_only_smooth = True
    bpy.ops.object.modifier_apply(modifier=sm.name)
    bpy.ops.object.shade_smooth()
    print(f'{ob.name}: {faces} -> {len(ob.data.polygons)} faces', flush=True)


class Nodes:
    """Tiny helper around a material node tree."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.n = self.nt.nodes
        self.l = self.nt.links

    def new(self, kind, **props):
        node = self.n.new(kind)
        for k, v in props.items():
            if k.startswith('in_'):
                node.inputs[k[3:].replace('_', ' ')].default_value = v
            else:
                setattr(node, k, v)
        return node

    def link(self, a, b):
        self.l.new(a, b)

    def ramp(self, inp, stops):
        r = self.new('ShaderNodeValToRGB')
        els = r.color_ramp.elements
        els[0].position, els[0].color = stops[0]
        els[1].position, els[1].color = stops[-1]
        for pos, col in stops[1:-1]:
            e = els.new(pos)
            e.color = col
        self.link(inp, r.inputs['Fac'])
        return r

    def mix(self, fac, a, b, blend='MIX'):
        m = self.new('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        ins = [i for i in m.inputs if i.type == 'RGBA']
        if isinstance(fac, float):
            m.inputs['Factor'].default_value = fac
        else:
            self.link(fac, m.inputs['Factor'])
        for sock, val in ((ins[0], a), (ins[1], b)):
            if isinstance(val, tuple):
                sock.default_value = val
            else:
                self.link(val, sock)
        return [o for o in m.outputs if o.type == 'RGBA'][0]

    def math(self, op, a, b=None, clamp=False):
        m = self.new('ShaderNodeMath', operation=op, use_clamp=clamp)
        for sock, val in zip(m.inputs, (a, b)):
            if val is None:
                continue
            if isinstance(val, (int, float)):
                sock.default_value = val
            else:
                self.link(val, sock)
        return m.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.5, out='Fac'):
        t = self.new('ShaderNodeTexNoise', in_Scale=scale, in_Detail=detail, in_Roughness=rough)
        self.link(vec, t.inputs['Vector'])
        return t.outputs[out]

    def bump(self, height, strength, distance, normal=None):
        b = self.new('ShaderNodeBump', in_Strength=strength, in_Distance=distance)
        self.link(height, b.inputs['Height'])
        if normal is not None:
            self.link(normal, b.inputs['Normal'])
        return b.outputs['Normal']


def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = Nodes(mat)
    bsdf = nodes.n.get('Principled BSDF')
    return mat, nodes, bsdf


# ------------------------------------------------------------------ procedural shaders
def bone_material():
    mat, N, bsdf = new_material('bone_proc')
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    # colour: two scales of mottling, sparse stains, cavity dirt, worn edges
    mott = N.ramp(N.noise(co, 3.2, 8, 0.58), [(0.32, srgb('#EDE5D2')), (0.55, srgb('#E2D6BC')), (0.75, srgb('#CDBB97'))])
    fine = N.noise(co, 26.0, 6, 0.6)
    col = N.mix(N.math('MULTIPLY', fine, 0.35), mott.outputs['Color'], srgb('#D8C7A3'))
    stain_mask = N.ramp(N.noise(co, 1.4, 4, 0.5), [(0.56, (0, 0, 0, 1)), (0.72, (1, 1, 1, 1))])
    col = N.mix(N.math('MULTIPLY', stain_mask.outputs['Color'], 0.45), col, srgb('#AE936A'))
    ao = N.new('ShaderNodeAmbientOcclusion', samples=16, in_Distance=0.10)
    dirt = N.ramp(ao.outputs['AO'], [(0.30, (1, 1, 1, 1)), (0.92, (0, 0, 0, 1))])
    col = N.mix(N.math('MULTIPLY', dirt.outputs['Color'], 0.85), col, srgb('#6E5A40'))
    geo = N.new('ShaderNodeNewGeometry')
    edge = N.ramp(geo.outputs['Pointiness'], [(0.52, (0, 0, 0, 1)), (0.58, (1, 1, 1, 1))])
    col = N.mix(N.math('MULTIPLY', edge.outputs['Color'], 0.35), col, srgb('#F6F1E4'))
    N.link(col, bsdf.inputs['Base Color'])
    # roughness: drier in cavities, slightly polished on edges
    r = N.math('ADD', N.math('MULTIPLY', N.noise(co, 9.0, 4), 0.22), 0.42)
    r = N.math('ADD', r, N.math('MULTIPLY', dirt.outputs['Color'], 0.18), clamp=True)
    N.link(r, bsdf.inputs['Roughness'])
    # surface: undulation, pores, micro pits, tiny cracks
    und = N.bump(N.noise(co, 14.0, 5, 0.55), 0.22, 0.012)
    pores = N.bump(N.noise(co, 210.0, 2, 0.5), 0.10, 0.002, und)
    vor = N.new('ShaderNodeTexVoronoi', in_Scale=55.0)
    N.link(co, vor.inputs['Vector'])
    pits = N.ramp(vor.outputs['Distance'], [(0.05, (0, 0, 0, 1)), (0.11, (1, 1, 1, 1))])
    nrm = N.bump(pits.outputs['Color'], 0.28, 0.003, pores)
    crack = N.new('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE', in_Scale=7.0)
    N.link(co, crack.inputs['Vector'])
    crk = N.ramp(crack.outputs['Distance'], [(0.0, (0, 0, 0, 1)), (0.012, (1, 1, 1, 1))])
    nrm = N.bump(crk.outputs['Color'], 0.12, 0.004, nrm)
    N.link(nrm, bsdf.inputs['Normal'])
    return mat


def enamel_material():
    mat, N, bsdf = new_material('enamel_proc')
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    sep = N.new('ShaderNodeSeparateXYZ')
    N.link(co, sep.inputs['Vector'])
    # Blender Z == web Y; biting plane at web y ~ -0.706
    dist = N.math('ABSOLUTE', N.math('SUBTRACT', sep.outputs['Z'], -0.706))
    grad = N.new('ShaderNodeMapRange', in_From_Min=0.0, in_From_Max=0.11)
    N.link(dist, grad.inputs['Value'])
    col = N.ramp(grad.outputs['Result'], [(0.0, srgb('#ECEAE4')), (0.3, srgb('#F5F0E2')), (0.75, srgb('#EADDBF')), (1.0, srgb('#CFB78C'))])
    c = N.mix(N.math('MULTIPLY', N.noise(co, 40.0, 4), 0.18), col.outputs['Color'], srgb('#EFE4CA'))
    ao = N.new('ShaderNodeAmbientOcclusion', samples=16, in_Distance=0.03)
    dirt = N.ramp(ao.outputs['AO'], [(0.35, (1, 1, 1, 1)), (0.95, (0, 0, 0, 1))])
    c = N.mix(N.math('MULTIPLY', dirt.outputs['Color'], 0.55), c, srgb('#8A7350'))
    N.link(c, bsdf.inputs['Base Color'])
    N.link(N.math('ADD', N.math('MULTIPLY', grad.outputs['Result'], 0.18), 0.2), bsdf.inputs['Roughness'])
    wave = N.new('ShaderNodeTexWave', in_Scale=60.0, in_Distortion=2.0)
    N.link(co, wave.inputs['Vector'])
    nrm = N.bump(wave.outputs['Fac'], 0.03, 0.001)
    nrm = N.bump(N.noise(co, 300.0, 2), 0.04, 0.001, nrm)
    N.link(nrm, bsdf.inputs['Normal'])
    return mat


def cotton_material(name, base_hex, dirt_hex, rough=0.86):
    mat, N, bsdf = new_material(name)
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    c = N.mix(N.math('MULTIPLY', N.noise(co, 6.0, 6), 0.4), srgb(base_hex), srgb(dirt_hex))
    ao = N.new('ShaderNodeAmbientOcclusion', samples=16, in_Distance=0.08)
    grime = N.ramp(ao.outputs['AO'], [(0.4, (1, 1, 1, 1)), (0.95, (0, 0, 0, 1))])
    c = N.mix(N.math('MULTIPLY', grime.outputs['Color'], 0.5), c, (0.0, 0.0, 0.0, 1.0))
    N.link(c, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    nrm = N.bump(N.noise(co, 90.0, 3), 0.12, 0.002)
    N.link(nrm, bsdf.inputs['Normal'])
    return mat


def bandana_material():
    mat, N, bsdf = new_material('bandana_proc')
    uv = N.new('ShaderNodeUVMap', uv_map='UVMap')
    img = N.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(str(SRC / 'bandana.png'))
    img.interpolation = 'Cubic'
    N.link(uv.outputs['UV'], img.inputs['Vector'])
    co = N.new('ShaderNodeTexCoord').outputs['Object']
    c = N.mix(N.math('MULTIPLY', N.noise(co, 30.0, 4), 0.12), img.outputs['Color'], srgb('#8F2219'))
    N.link(c, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    nrm = N.bump(N.noise(co, 260.0, 2), 0.10, 0.0015)
    N.link(nrm, bsdf.inputs['Normal'])
    return mat


def simple_material(name, hexcol, rough, coat=0.0, spec=0.5, image=None):
    mat, N, bsdf = new_material(name)
    bsdf.inputs['Base Color'].default_value = srgb(hexcol)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Specular IOR Level'].default_value = spec
    if image:
        t = N.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(image))
        N.link(t.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


# ------------------------------------------------------------------ baking
def setup_cycles(samples=64):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dev_type in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = dev_type
            prefs.get_devices()
            if any(d.type == dev_type for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == dev_type
                sc.cycles.device = 'GPU'
                print('cycles device', dev_type, flush=True)
                break
        except Exception:  # noqa: BLE001
            continue
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new('world')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.30, 0.29, 0.28, 1)
    bg.inputs['Strength'].default_value = 0.4
    world.light_settings.distance = 0.30


def unwrap(ob, uv_name='bake'):
    activate(ob)
    uv = ob.data.uv_layers.new(name=uv_name)
    ob.data.uv_layers.active = uv
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(64), island_margin=0.0025, area_weight=0.6)
    bpy.ops.object.mode_set(mode='OBJECT')
    return uv


def bake_pass(ob, kind, size, samples, non_color=False):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    img = bpy.data.images.new(f'{ob.name}_{kind.lower()}', size, size, alpha=False, float_buffer=(kind == 'NORMAL'))
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    added = []
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = img
        nt.nodes.active = node
        added.append((nt, node))
    activate(ob)
    bk = sc.render.bake
    bk.margin = 6
    bk.target = 'IMAGE_TEXTURES'
    bk.use_selected_to_active = False
    if kind == 'DIFFUSE':
        bk.use_pass_direct = False
        bk.use_pass_indirect = False
        bk.use_pass_color = True
    bpy.ops.object.bake(type=kind)
    for nt, node in added:
        nt.nodes.remove(node)
    print(f'baked {ob.name} {kind} {size}px', flush=True)
    return img


def save_png(img, path):
    img.filepath_raw = str(path)
    img.file_format = 'PNG'
    img.save()


def pixels(img):
    a = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def bake_object(ob, size, ao_strength=0.85):
    BAKE.mkdir(parents=True, exist_ok=True)
    albedo = bake_pass(ob, 'DIFFUSE', size, 1)
    rough = bake_pass(ob, 'ROUGHNESS', size, 1, non_color=True)
    normal = bake_pass(ob, 'NORMAL', size, 4, non_color=True)
    ao = bake_pass(ob, 'AO', size, 96 if not FAST else 16, non_color=True)
    # albedo *= AO (soft), so contact shadows survive any renderer
    a, o = pixels(albedo), pixels(ao)
    occ = o[..., :1]
    a[..., :3] *= (1.0 - ao_strength) + ao_strength * occ ** 1.2
    albedo.pixels.foreach_set(a.ravel())
    for img, tag in ((albedo, 'albedo'), (rough, 'rough'), (normal, 'normal'), (ao, 'ao')):
        save_png(img, BAKE / f'{ob.name}_{tag}.png')
    return albedo, rough, normal


def baked_material(name, albedo, rough, normal, sss=0.0, coat=0.0):
    mat, N, bsdf = new_material(name)
    ta = N.new('ShaderNodeTexImage')
    ta.image = albedo
    N.link(ta.outputs['Color'], bsdf.inputs['Base Color'])
    tr = N.new('ShaderNodeTexImage')
    tr.image = rough
    tr.image.colorspace_settings.name = 'Non-Color'
    N.link(tr.outputs['Color'], bsdf.inputs['Roughness'])
    tn = N.new('ShaderNodeTexImage')
    tn.image = normal
    tn.image.colorspace_settings.name = 'Non-Color'
    nm = N.new('ShaderNodeNormalMap')
    N.link(tn.outputs['Color'], nm.inputs['Color'])
    N.link(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if sss:
        bsdf.inputs['Subsurface Weight'].default_value = sss
        bsdf.inputs['Subsurface Radius'].default_value = (0.04, 0.02, 0.012)
    bsdf.inputs['Coat Weight'].default_value = coat
    return mat


# ------------------------------------------------------------------ lighting / previews
def add_light(name, loc, energy, color, size, target=(0, 0, -0.1)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def setup_lights():
    add_light('key', (-2.6, -3.4, 3.0), 950, (1.0, 0.95, 0.88), 2.0)
    add_light('rim', (2.8, 2.4, 1.6), 1300, (1.0, 0.30, 0.20), 1.4)
    add_light('fill', (3.2, -3.0, 0.0), 200, (0.85, 0.9, 1.0), 3.0)
    add_light('top', (0, 0.6, 4.0), 240, (1, 1, 1), 2.0)


def render_view(name, cam_loc, target=(0, 0, -0.15), lens=62, res=(900, 1100), samples=96):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cam = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    sc.camera = cam
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = str(SRC / f'preview_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', sc.render.filepath, flush=True)


def export_glb(out=None):
    out = out or OUT_GLB
    out.parent.mkdir(parents=True, exist_ok=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    want = dict(
        filepath=str(out), export_format='GLB', use_selection=False, export_apply=True,
        export_yup=True, export_texcoord=True, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_image_format='WEBP', export_image_quality=82,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_vertex_color='NONE',
        export_cameras=False, export_lights=False,
    )
    kwargs = {k: v for k, v in want.items() if k in props}
    missing = [k for k in want if k not in props]
    if missing:
        print('gltf options not available:', missing, flush=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(**kwargs)
    print('exported', out, out.stat().st_size // 1024, 'KB', flush=True)


# ------------------------------------------------------------------ main
def main():
    clear_scene()
    names = ['skull', 'teeth', 'cap', 'patch', 'glasses', 'lenses', 'bandana', 'neck']
    objs = {}
    for n in names:
        ob = import_part(n)
        clean_and_decimate(ob, TARGETS[n])
        objs[n] = ob

    proc = {
        'skull': bone_material(),
        'teeth': enamel_material(),
        'cap': cotton_material('cap_proc', '#141414', '#090909'),
        'bandana': bandana_material(),
    }
    brim = cotton_material('brim_proc', '#D4362B', '#9E2219', rough=0.82)
    for n, mat in proc.items():
        objs[n].data.materials.clear()
        objs[n].data.materials.append(mat)
    cap = objs['cap']
    cap.data.materials.append(brim)
    for poly in cap.data.polygons:
        web_y, web_z = poly.center.z, -poly.center.y
        if web_z > 0.80 and poly.normal.z < -0.45 and web_y < 0.27:
            poly.material_index = 1
    finals = {
        'patch': simple_material('patch', '#FFFFFF', 0.7, image=SRC / 'patch.png'),
        'glasses': simple_material('frame', '#0D0D0D', 0.16, coat=1.0),
        'lenses': simple_material('lens', '#140C0B', 0.03, spec=1.0),
        'neck': simple_material('neck', '#191615', 0.9),
    }
    for n, mat in finals.items():
        objs[n].data.materials.clear()
        objs[n].data.materials.append(mat)

    setup_cycles()
    for n in ('skull', 'teeth', 'cap', 'bandana'):
        ob = objs[n]
        had_uv = 'UVMap' in ob.data.uv_layers
        unwrap(ob)
        alb, rgh, nrm = bake_object(ob, BAKE_SIZE[n], ao_strength=0.9 if n != 'teeth' else 0.75)
        final = baked_material(n, alb, rgh, nrm, sss=0.12 if n in ('skull', 'teeth') else 0.0)
        ob.data.materials.clear()
        ob.data.materials.append(final)
        if had_uv:
            ob.data.uv_layers.remove(ob.data.uv_layers['UVMap'])
        ob.data.uv_layers['bake'].name = 'UVMap'

    setup_lights()
    render_view('three_quarter', (-2.6, -5.5, 0.45))
    render_view('front', (0.0, -6.2, 0.1))
    render_view('closeup', (-0.9, -3.2, -0.25), target=(0, 0, -0.45), lens=70, res=(1100, 900))
    if not FAST:
        render_view('profile', (-6.2, -0.3, 0.15))
    export_glb()


if __name__ == '__main__':
    main()
