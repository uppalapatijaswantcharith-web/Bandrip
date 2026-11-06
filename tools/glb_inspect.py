"""Print a GLB's metadata: asset/licence extras, nodes, meshes, skins, animations, materials, bounds."""
import json, struct, sys

def read(path):
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<4sII', f.read(12))
        clen, ctype = struct.unpack('<I4s', f.read(8))
        return json.loads(f.read(clen))

for p in sys.argv[1:]:
    g = read(p)
    print('=' * 70, '\n', p)
    print('asset:', json.dumps(g.get('asset', {}))[:600])
    print('scene extras:', json.dumps([s.get('extras') for s in g.get('scenes', [])])[:300])
    print('nodes:', len(g.get('nodes', [])), '| meshes:', len(g.get('meshes', [])), '| skins:', len(g.get('skins', [])), '| animations:', [a.get('name') for a in g.get('animations', [])][:12])
    print('materials:', [m.get('name') for m in g.get('materials', [])][:20])
    print('images:', [(i.get('name'), i.get('mimeType')) for i in g.get('images', [])][:20])
    print('extensionsUsed:', g.get('extensionsUsed'))
    names = [n.get('name') for n in g.get('nodes', [])]
    print('node names:', names[:40])
    tris = 0
    for m in g.get('meshes', []):
        for pr in m['primitives']:
            if 'indices' in pr:
                tris += g['accessors'][pr['indices']]['count'] // 3
    print('approx triangles:', tris)
    mins, maxs = [1e9] * 3, [-1e9] * 3
    for m in g.get('meshes', []):
        for pr in m['primitives']:
            a = g['accessors'][pr['attributes']['POSITION']]
            if 'min' in a:
                mins = [min(x, y) for x, y in zip(mins, a['min'])]
                maxs = [max(x, y) for x, y in zip(maxs, a['max'])]
    print('local bounds (unscaled):', [round(v, 3) for v in mins], [round(v, 3) for v in maxs])
