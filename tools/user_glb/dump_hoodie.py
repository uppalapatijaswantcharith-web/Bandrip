import bpy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src' / 'user_glb'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=str(SRC / 'sp5der_pnk_hoodie.glb'))
for ob in bpy.data.objects:
    if ob.type != 'MESH':
        continue
    m = ob.active_material
    imgs = []
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            out = [l.to_socket.name for l in n.outputs['Color'].links]
            imgs.append((n.image.name, n.image.size[:], out))
    print('OBJ', ob.name, len(ob.data.polygons), 'faces', m.name, imgs, 'uv', [u.name for u in ob.data.uv_layers], flush=True)
for im in bpy.data.images:
    if im.size[0]:
        im.filepath_raw = str(SRC / f'hoodie_{im.name.replace(".", "_")}.png'); im.file_format = 'PNG'; im.save()
        print('saved', im.name, im.size[:], flush=True)
