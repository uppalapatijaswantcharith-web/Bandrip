"""Render the hero backdrop: volumetric red street-smoke haze (Cycles, GPU).

blender --background --factory-startup --python tools/mascot/render_haze.py -- [--fast]
Writes assets_src/haze/haze_{wide,tall}.png; tools/process_haze.py converts to WebP.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets_src' / 'haze'
FAST = '--fast' in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for dev in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = dev
        prefs.get_devices()
        if any(d.type == dev for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == dev
            sc.cycles.device = 'GPU'
            break
    except Exception:  # noqa: BLE001
        pass
sc.cycles.samples = 48 if FAST else 256
sc.cycles.use_denoising = True
sc.cycles.volume_bounces = 2
sc.cycles.volume_step_rate = 1.0 if FAST else 0.5
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'

world = bpy.data.worlds.new('w')
sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#120B0A')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25

# smoke domain
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 6, 0))
dom = bpy.context.active_object
dom.scale = (26, 14, 12)
mat = bpy.data.materials.new('haze')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.remove(nt.nodes['Principled BSDF'])
vol = nt.nodes.new('ShaderNodeVolumePrincipled')
vol.inputs['Color'].default_value = srgb('#EFE6DC')
vol.inputs['Anisotropy'].default_value = 0.35
co = nt.nodes.new('ShaderNodeTexCoord')
mapping = nt.nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (2.6, 1.4, 1.2)
nt.links.new(co.outputs['Generated'], mapping.inputs['Vector'])
warp = nt.nodes.new('ShaderNodeTexNoise')
warp.inputs['Scale'].default_value = 0.9
warp.inputs['Detail'].default_value = 3
nt.links.new(mapping.outputs['Vector'], warp.inputs['Vector'])
mixv = nt.nodes.new('ShaderNodeMix')
mixv.data_type = 'VECTOR'
mixv.inputs['Factor'].default_value = 0.35
nt.links.new(mapping.outputs['Vector'], [i for i in mixv.inputs if i.type == 'VECTOR'][0])
nt.links.new(warp.outputs['Color'], [i for i in mixv.inputs if i.type == 'VECTOR'][1])
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3.4
noise.inputs['Detail'].default_value = 14
noise.inputs['Roughness'].default_value = 0.62
nt.links.new([o for o in mixv.outputs if o.type == 'VECTOR'][0], noise.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.50
ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
ramp.color_ramp.elements[1].position = 0.60
ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
# denser toward the bottom, thinning upward
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
nt.links.new(co.outputs['Generated'], sep.inputs['Vector'])
grad = nt.nodes.new('ShaderNodeMapRange')
grad.inputs['From Min'].default_value = 0.95
grad.inputs['From Max'].default_value = 0.25
nt.links.new(sep.outputs['Z'], grad.inputs['Value'])
dens = nt.nodes.new('ShaderNodeMath')
dens.operation = 'MULTIPLY'
nt.links.new(ramp.outputs['Color'], dens.inputs[0])
nt.links.new(grad.outputs['Result'], dens.inputs[1])
dens2 = nt.nodes.new('ShaderNodeMath')
dens2.operation = 'MULTIPLY'
dens2.inputs[1].default_value = 3.2
nt.links.new(dens.outputs[0], dens2.inputs[0])
nt.links.new(dens2.outputs[0], vol.inputs['Density'])
nt.links.new(vol.outputs['Volume'], nt.nodes['Material Output'].inputs['Volume'])
dom.data.materials.append(mat)


def light(name, loc, energy, color, size, target):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy, ld.color, ld.size = energy, color[:3], size
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


# signal-red back light (the flare), warm key, cool lift
light('flare', (3.0, 8.0, -3.5), 9000, srgb('#FF2A14'), 2.5, (0, 8, 2))
light('flare2', (-7.0, 10.0, -2.5), 7000, srgb('#E63228'), 2.0, (-6, 10, 2))
light('key', (-12, -2, 10), 14000, srgb('#FFE6C8'), 8, (0, 6, 0))
light('lift', (10, -2, -3), 6000, srgb('#C8D2E6'), 8, (0, 6, 0))

cd = bpy.data.cameras.new('cam')
cd.lens = 28
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (0, -8, 0.5)
cam.rotation_euler = (Vector((0, 6, 1.2)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
OUT.mkdir(parents=True, exist_ok=True)
for name, (w, h) in {'wide': (2400, 1350), 'tall': (1200, 1800)}.items():
    if FAST:
        w, h = w // 3, h // 3
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.filepath = str(OUT / f'haze_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name, flush=True)
