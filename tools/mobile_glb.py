"""Write phone-sized copies of GLBs: every embedded texture is capped at MAX px (WebP re-encode).

Meshes, materials and Draco buffers are copied byte-for-byte; only image bufferViews change.
Usage: python tools/mobile_glb.py static/models/mascot.glb static/models/crew.glb [--max 1024]
Writes <name>-m.glb next to each input. frontend/scenes/mascot.js loads these on phones.
"""

import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image


def pad4(data, fill=b'\0'):
    return data + fill * (-len(data) % 4)


def shrink_glb(src: Path, max_px: int) -> Path:
    raw = src.read_bytes()
    magic, version, _ = struct.unpack('<4sII', raw[:12])
    assert magic == b'glTF' and version == 2, f'{src}: not a glTF 2 binary'
    json_len, json_type = struct.unpack('<II', raw[12:20])
    assert json_type == 0x4E4F534A
    gltf = json.loads(raw[20:20 + json_len])
    bin_hdr = 20 + json_len
    bin_len, bin_type = struct.unpack('<II', raw[bin_hdr:bin_hdr + 8])
    assert bin_type == 0x004E4942
    bin_data = raw[bin_hdr + 8:bin_hdr + 8 + bin_len]

    image_views = {}
    for img in gltf.get('images', []):
        if 'bufferView' not in img:
            continue
        bv = gltf['bufferViews'][img['bufferView']]
        blob = bin_data[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        pic = Image.open(io.BytesIO(blob))
        if max(pic.size) <= max_px:
            continue
        scale = max_px / max(pic.size)
        pic = pic.convert('RGBA' if pic.mode in ('RGBA', 'LA', 'P') else 'RGB')
        pic = pic.resize((round(pic.width * scale), round(pic.height * scale)), Image.LANCZOS)
        out = io.BytesIO()
        pic.save(out, 'WEBP', quality=82, method=6)
        image_views[img['bufferView']] = out.getvalue()
        img['mimeType'] = 'image/webp'

    new_bin = bytearray()
    for i, bv in enumerate(gltf['bufferViews']):
        start = bv.get('byteOffset', 0)
        chunk = image_views.get(i, bin_data[start:start + bv['byteLength']])
        new_bin += b'\0' * (-len(new_bin) % 4)
        bv['byteOffset'] = len(new_bin)
        bv['byteLength'] = len(chunk)
        new_bin += chunk
    new_bin = pad4(bytes(new_bin))
    gltf['buffers'][0]['byteLength'] = len(new_bin)

    json_bytes = pad4(json.dumps(gltf, separators=(',', ':')).encode(), b' ')
    total = 12 + 8 + len(json_bytes) + 8 + len(new_bin)
    dst = src.with_name(src.stem + '-m.glb')
    dst.write_bytes(
        struct.pack('<4sII', b'glTF', 2, total)
        + struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes
        + struct.pack('<II', len(new_bin), 0x004E4942) + new_bin
    )
    print(f'{src.name}: {len(raw) / 1e6:.2f} MB -> {dst.name}: {total / 1e6:.2f} MB ({len(image_views)} textures resized)')
    return dst


if __name__ == '__main__':
    args = sys.argv[1:]
    max_px = 1024
    if '--max' in args:
        i = args.index('--max')
        max_px = int(args[i + 1])
        del args[i:i + 2]
    for path in args:
        shrink_glb(Path(path), max_px)
