"""Rig and animate the runway mannequin, then export static/models/walker.glb.

blender --background --factory-startup --python tools/runway/blender_walker.py -- [--preview-only]

Armature built from the sculpt's joint positions, automatic (bone heat) weights,
hand-keyed 30-frame runway walk (in place; the site moves figures along the runway).
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'mascot'))
import blender_finish as bf  # noqa: E402
from joints import J  # noqa: E402

ROOT = HERE.parents[1]
SRC = ROOT / 'assets_src' / 'runway'
OUT = ROOT / 'static' / 'models' / 'walker.glb'
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CYCLE = 30


def B(key, side=1):
    x, y, z = J[key]
    return Vector((x * side, -z, y))   # web -> blender


def build_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = 'rig'
    eb = arm.data.edit_bones
    eb.remove(eb[0])

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = head, tail
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone('hips', B('hip_c'), B('spine'))
    bone('spine', B('spine'), B('chest'), 'hips', True)
    bone('chest', B('chest'), B('neck'), 'spine', True)
    bone('neck', B('neck'), B('head'), 'chest', True)
    bone('head', B('head'), B('top'), 'neck', True)
    for side, s in (('L', 1), ('R', -1)):
        bone(f'upper_arm.{side}', B('shoulder', s), B('elbow', s), 'chest')
        bone(f'forearm.{side}', B('elbow', s), B('wrist', s), f'upper_arm.{side}', True)
        bone(f'hand.{side}', B('wrist', s), B('hand', s) + Vector((0, 0, -0.07)), f'forearm.{side}', True)
        bone(f'thigh.{side}', B('hip', s), B('knee', s), 'hips')
        bone(f'shin.{side}', B('knee', s), B('ankle', s), f'thigh.{side}', True)
        bone(f'foot.{side}', B('ankle', s), B('toe', s), f'shin.{side}', True)
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def world_axis_rot(pbone, axis, deg):
    """Rotation about a world axis, expressed in the bone's rest (local) frame."""
    rest = pbone.bone.matrix_local.to_quaternion()
    q = Quaternion(axis, math.radians(deg))
    return rest.inverted() @ q @ rest


def key_walk(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    pb = arm.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 0, CYCLE
    sc.render.fps = 30
    for f in range(0, CYCLE + 1):
        ph = 2 * math.pi * f / CYCLE
        s, c = math.sin(ph), math.cos(ph)
        # legs: negative rotation about +X swings forward (-Y is the figure's front)
        thigh = {'L': -27 * s, 'R': 27 * s}
        knee = {'L': 6 + 58 * max(0.0, c) ** 1.6, 'R': 6 + 58 * max(0.0, -c) ** 1.6}
        for side in ('L', 'R'):
            pb[f'thigh.{side}'].rotation_quaternion = world_axis_rot(pb[f'thigh.{side}'], X, thigh[side])
            pb[f'shin.{side}'].rotation_quaternion = world_axis_rot(pb[f'shin.{side}'], X, knee[side])
            foot = -0.55 * (thigh[side] + knee[side]) + (12 if (thigh[side] > 18) else 0)
            pb[f'foot.{side}'].rotation_quaternion = world_axis_rot(pb[f'foot.{side}'], X, foot)
        # hips: catwalk twist, drop, bob
        hips = pb['hips']
        hips.rotation_quaternion = world_axis_rot(hips, Z, 7 * s) @ world_axis_rot(hips, Y, -4 * s)
        hips.location = Vector((0, 0, 0))
        hips.location.y = 0.022 * math.cos(2 * ph) - 0.012          # bone-local Y is world up for the hips bone
        pb['spine'].rotation_quaternion = world_axis_rot(pb['spine'], Z, -4 * s) @ world_axis_rot(pb['spine'], Y, 2.5 * s)
        pb['chest'].rotation_quaternion = world_axis_rot(pb['chest'], Z, -5 * s)
        pb['neck'].rotation_quaternion = world_axis_rot(pb['neck'], Z, 2.5 * s)
        # arms swing opposite to legs, relaxed elbows
        arm_sw = {'L': 17 * s, 'R': -17 * s}
        for side in ('L', 'R'):
            pb[f'upper_arm.{side}'].rotation_quaternion = world_axis_rot(pb[f'upper_arm.{side}'], X, arm_sw[side])
            pb[f'forearm.{side}'].rotation_quaternion = world_axis_rot(pb[f'forearm.{side}'], X, -12 - 6 * max(0.0, -arm_sw[side] / 17))
        for b in pb:
            b.keyframe_insert('rotation_quaternion', frame=f)
        hips.keyframe_insert('location', frame=f)
    act = arm.animation_data.action
    act.name = 'walk'
    bpy.ops.object.mode_set(mode='OBJECT')


def main():
    bf.clear_scene()
    bpy.ops.wm.obj_import(filepath=str(SRC / 'walker.obj'), forward_axis='NEGATIVE_Z', up_axis='Y')
    body = bpy.context.selected_objects[0]
    body.name = body.data.name = 'walker'
    bf.clean_and_decimate(body, 16000)
    colors = {'skin': ('#D9D4CA', 0.55), 'tee': ('#EEEBE3', 0.85), 'pants': ('#2B2A28', 0.85), 'shoes': ('#F2F0E9', 0.5), 'cap': ('#151515', 0.8)}
    for slot in body.material_slots:
        m = slot.material
        name = m.name.split('.')[0]
        m.name = name
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        col, rough = colors.get(name, ('#888888', 0.7))
        bsdf.inputs['Base Color'].default_value = bf.srgb(col)
        bsdf.inputs['Roughness'].default_value = rough
    arm = build_armature()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    groups = [g.name for g in body.vertex_groups]
    print('vertex groups', len(groups), groups, flush=True)
    key_walk(arm)

    # preview strip: side view across the cycle
    bf.setup_cycles(32)
    bf.setup_lights()
    sc = bpy.context.scene
    bf.SRC = SRC
    for f in (0, 5, 10, 15, 20, 25):
        sc.frame_set(f)
        bf.render_view(f'walk_{f:02d}', (-4.2, 0.0, 1.0), target=(0, 0, 0.9), lens=50, res=(420, 640), samples=16)
    sc.frame_set(0)
    bf.render_view('walk_front', (0.0, -4.4, 1.0), target=(0, 0, 0.9), lens=50, res=(420, 640), samples=16)
    if '--preview-only' in ARGS:
        return
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    want = dict(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=False, export_animations=True,
                export_skins=True, export_draco_mesh_compression_enable=False, export_materials='EXPORT',
                export_frame_range=True, export_force_sampling=True, export_animation_mode='ACTIONS',
                export_cameras=False, export_lights=False)
    bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
    print('exported', OUT, OUT.stat().st_size // 1024, 'KB', flush=True)


main()
