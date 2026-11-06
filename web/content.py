"""Structured demo content for the BANDRIP prototype.

Everything here is placeholder copy and filler data for a client presentation.
Item names, fabric notes and studio details are not confirmed BANDRIP information.
"""

import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent / 'data' / 'photos.json'


@lru_cache(maxsize=1)
def _photos():
    return {p['id']: p for p in json.loads(DATA.read_text(encoding='utf-8'))}


def photo(pid):
    return _photos()[pid]


def photos(ids):
    return [photo(i) for i in ids]


def all_photos():
    return list(_photos().values())


# Seven depot categories. `object` is the 3D object id in depot.glb.
CATEGORIES = [
    {
        'slug': 'oversized-tees', 'num': '01', 'name': 'Oversized Tees', 'short': 'Tees', 'object': 'tee',
        'field': '#F2F0E9', 'ink': '#151515',
        'line': 'Drop shoulder, boxy body, heavyweight jersey.',
        'spec': ['FIT: BOXY / DROP SHOULDER', 'WEIGHT: 240 GSM (DEMO)', 'NECK: 2 CM RIB'],
        'photos': [19402530, 10034631, 9726634, 17400728, 20304547, 4103983],
    },
    {
        'slug': 'shirts', 'num': '02', 'name': 'Shirts', 'short': 'Shirts', 'object': 'shirt',
        'field': '#E4DCCB', 'ink': '#151515',
        'line': 'Camp collars and long boxy cuts, worn open or buttoned to the top.',
        'spec': ['FIT: RELAXED', 'COLLAR: CAMP / POINT', 'FABRIC: COTTON POPLIN (DEMO)'],
        'photos': [18767315, 4287123, 9726634, 19402530, 10034631],
    },
    {
        'slug': 'jackets', 'num': '03', 'name': 'Jackets & Outerwear', 'short': 'Outerwear', 'object': 'jacket',
        'field': '#2A2927', 'ink': '#F2F0E9',
        'line': 'Denim, leather and nylon shells cut with room to layer.',
        'spec': ['FIT: CROPPED / OVERSIZED', 'SHELL: DENIM, LEATHER, NYLON (DEMO)', 'HARDWARE: GUNMETAL'],
        'photos': [12150950, 18714712, 17244591, 3483102, 9874909, 2887455, 12317767, 3888450],
    },
    {
        'slug': 'pants-cargos', 'num': '04', 'name': 'Pants & Cargos', 'short': 'Cargos', 'object': 'pants',
        'field': '#A9A59C', 'ink': '#151515',
        'line': 'Wide legs, bellows pockets, adjustable hems.',
        'spec': ['FIT: WIDE / STACKED', 'POCKETS: 6 (DEMO)', 'HEM: TOGGLE CINCH'],
        'photos': [17037339, 19392459, 29738025, 4052281, 16362243, 17400728],
    },
    {
        'slug': 'caps', 'num': '05', 'name': 'Caps', 'short': 'Caps', 'object': 'cap',
        'field': '#151515', 'ink': '#F2F0E9',
        'line': 'Six-panel crowns, curved brims, woven patch.',
        'spec': ['CROWN: 6 PANEL', 'BRIM: PRE-CURVED', 'CLOSURE: STRAPBACK (DEMO)'],
        'photos': [12683305, 35515095, 29346779, 7549564, 20304547, 2479951],
    },
    {
        'slug': 'sunglasses', 'num': '06', 'name': 'Sunglasses', 'short': 'Shades', 'object': 'shades',
        'field': '#E63228', 'ink': '#151515',
        'line': 'Flat-top wraps and wide acetate frames.',
        'spec': ['FRAME: ACETATE (DEMO)', 'LENS: CAT. 3 TINT (DEMO)', 'FIT: WIDE'],
        'photos': [27631546, 20446138, 7549564, 12683305, 17037339],
    },
    {
        'slug': 'bandanas-accessories', 'num': '07', 'name': 'Bandanas & Accessories', 'short': 'Bandanas', 'object': 'bandana',
        'field': '#F2F0E9', 'ink': '#151515',
        'line': 'Paisley squares worn as masks, headbands and neck ties.',
        'spec': ['SIZE: 55 x 55 CM (DEMO)', 'PRINT: PAISLEY', 'FABRIC: COTTON (DEMO)'],
        'photos': [10863547, 6146435, 1820987, 5641779, 27163538, 4287123],
    },
]

CATEGORY_BY_SLUG = {c['slug']: c for c in CATEGORIES}

# Demo item names per category (gallery captions). Not real inventory.
ITEM_NAMES = {
    'oversized-tees': ['Block Tee', 'Static Tee', 'Curb Tee', 'Siren Tee', 'Overpass Tee', 'Signal Tee'],
    'shirts': ['Camp Shirt', 'Night Shift Shirt', 'Block Poplin', 'Grid Shirt', 'Ledger Shirt'],
    'jackets': ['Ripstop Shell', 'Moto Jacket', 'Wash Denim Trucker', 'Dock Jacket', 'Crop Denim', 'Alley Leather', 'Painted Trucker', 'Hood Shell'],
    'pants-cargos': ['Bellows Cargo', 'Stack Cargo', 'Wide Utility', 'Track Cargo', 'Wide Denim', 'Camo Cargo'],
    'caps': ['Patch Cap', 'Washed Cap', 'Sand Cap', 'Navy Cap', 'Dusk Cap', 'Crossing Cap'],
    'sunglasses': ['Flat-Top Wrap', 'Wide Acetate', 'Navigator', 'Round Mono', 'Shield'],
    'bandanas-accessories': ['Paisley Mask', 'Black Paisley', 'Red Square', 'Blue Square', 'Pink Paisley', 'Headband Tie'],
}


def gallery(cat):
    names = ITEM_NAMES[cat['slug']]
    items = []
    for i, pid in enumerate(cat['photos']):
        items.append({
            'photo': photo(pid),
            'name': names[i % len(names)],
            'code': f"BR-{cat['num']}{i + 1:02d}",
            # editorial rhythm: tall, wide, standard
            'span': ['tall', 'std', 'wide', 'std', 'tall', 'std', 'wide', 'std'][i % 8],
        })
    return items


# Homepage product families for the pinned DICH-style collections chapter.
HOME_FAMILIES = [
    {'num': '01', 'name': 'TEES', 'slug': 'oversized-tees', 'disc': 19402530, 'thumbs': [10034631, 9726634, 17400728, 20304547],
     'spec': ['FIT_DNA: BOXY', 'WEIGHT: HEAVY', 'SHOULDER: DROPPED'], 'line': 'Boxy, heavy and cut long enough to stack over cargos.'},
    {'num': '02', 'name': 'SHIRTS', 'slug': 'shirts', 'disc': 18767315, 'thumbs': [4287123, 9726634, 19402530, 10034631],
     'spec': ['FIT_DNA: RELAXED', 'COLLAR: CAMP', 'WEAR: OPEN'], 'line': 'Camp collars and long hems, worn open over a tee.'},
    {'num': '03', 'name': 'JACKETS', 'slug': 'jackets', 'disc': 12150950, 'thumbs': [18714712, 17244591, 9874909, 2887455],
     'spec': ['FIT_DNA: OVERSIZED', 'SHELL: DENIM / LEATHER', 'LAYER: YES'], 'line': 'Shells with room underneath for a hoodie and a tee.'},
    {'num': '04', 'name': 'CARGOS', 'slug': 'pants-cargos', 'disc': 17037339, 'thumbs': [19392459, 29738025, 4052281, 16362243],
     'spec': ['FIT_DNA: WIDE', 'POCKETS: BELLOWS', 'HEM: CINCH'], 'line': 'Wide legs and bellows pockets that stack over the shoe.'},
    {'num': '05', 'name': 'ACCESSORIES', 'slug': 'bandanas-accessories', 'disc': 10863547, 'thumbs': [12683305, 27631546, 1820987, 6146435],
     'spec': ['CAPS: 6 PANEL', 'SHADES: WRAP', 'BANDANA: PAISLEY'], 'line': 'Caps, shades and bandanas to finish the uniform.'},
]

HOME_IDENTITY = [19402530, 12150950]
HOME_MODELS = [20229010, 29738025, 13304394, 20446138, 16362243]
RUNWAY_CIRCLES = [20446138, 27631546, 16362243]
RUNWAY_LINEUP = [19402530, 17037339, 12150950, 29738025, 19392459, 18714712, 4052281, 3888450]
MENU_FIGURES = [19402530, 29738025]

# Models page
PORTFOLIO = [
    {'pid': 20229010, 'name': 'Look 01', 'tag': 'Editorial'},
    {'pid': 29738025, 'name': 'Look 02', 'tag': 'Studio'},
    {'pid': 16362243, 'name': 'Look 03', 'tag': 'Studio'},
    {'pid': 20446138, 'name': 'Look 04', 'tag': 'Editorial'},
    {'pid': 17474220, 'name': 'Look 05', 'tag': 'Campaign'},
    {'pid': 13304394, 'name': 'Look 06', 'tag': 'Movement'},
    {'pid': 20029584, 'name': 'Look 07', 'tag': 'Movement'},
    {'pid': 4052282, 'name': 'Look 08', 'tag': 'Street'},
    {'pid': 2887455, 'name': 'Look 09', 'tag': 'Street'},
]

STUDIO_TRACKS = [
    {'num': '.001', 'title': 'Walk', 'text': 'Runway walk, turns and timing, practised on a marked floor. Session length and frequency to be confirmed by BANDRIP.'},
    {'num': '.002', 'title': 'Pose', 'text': 'Working to camera in streetwear: weight, hands, layering and how a garment hangs in a still frame.'},
    {'num': '.003', 'title': 'Style', 'text': 'Putting looks together from the collection and finding a personal angle on fit, colour and accessories.'},
    {'num': '.004', 'title': 'Shoot', 'text': 'Test shoots with the studio team, producing images for a portfolio. Terms and usage rights to be confirmed.'},
]

# Lookbook / community
LOOKS = [
    {'num': 'LOOK_01', 'title': 'Overpass', 'field': '#E63228', 'ink': '#151515', 'photo': 3483102,
     'story': 'A denim trucker over a heavy tee, shot at the waterline under the flyover.',
     'pieces': ['Wash Denim Trucker', 'Block Tee', 'Wide Utility']},
    {'num': 'LOOK_02', 'title': 'Concrete', 'field': '#2A2927', 'ink': '#F2F0E9', 'photo': 12150950,
     'story': 'Black on charcoal. A shell, a long tee and a chain, against poured concrete.',
     'pieces': ['Hood Shell', 'Static Tee', 'Stack Cargo']},
    {'num': 'LOOK_03', 'title': 'Signal', 'field': '#F2F0E9', 'ink': '#151515', 'photo': 29738025,
     'story': 'Wide blue cargos and a printed vest on a white sweep, styled for movement.',
     'pieces': ['Wide Utility', 'Grid Vest', 'Paisley Mask']},
]
COMMUNITY = [10034631, 1820987, 17400728, 5641779, 9876711, 4103983, 27163538, 2344601, 19392459]

# Stores / contact — all placeholders
STORES = [
    {'city': 'Hyderabad', 'name': 'BANDRIP Studio & Store', 'address': 'Street address to be confirmed', 'hours': 'Hours to be confirmed', 'note': 'Studio sessions by appointment (placeholder)'},
    {'city': 'Bengaluru', 'name': 'Pop-up', 'address': 'Location to be confirmed', 'hours': 'Dates to be confirmed', 'note': 'Placeholder'},
    {'city': 'Mumbai', 'name': 'Stockist', 'address': 'Stockist to be confirmed', 'hours': '—', 'note': 'Placeholder'},
]


# Third-party 3D models supplied by the client (all CC BY 4.0, attribution required) and CC0 materials.
ASSET_CREDITS = [
    {'what': 'Cowboy Hat (mascot)', 'author': 'MadeByYeshe', 'url': 'https://sketchfab.com/3d-models/cowboy-hat-15fd37f4e03c447b995b5851cac52801', 'licence': 'CC BY 4.0', 'changes': 'Recoloured to black felt, scaled and fitted to the BANDRIP skull in Blender'},
    {'what': 'Bandana Mask (mascot)', 'author': 'Tactical_Gamer', 'url': 'https://sketchfab.com/3d-models/bandana-mask-1d39e7ae6b5748acb2ffddf420893f5a', 'licence': 'CC BY 4.0', 'changes': 'Subdivided and shrink-wrapped onto the skull in Blender'},
    {'what': 'Hoodie (THE DROP)', 'author': 'Harrison.Clayton', 'url': 'https://sketchfab.com/3d-models/sp5der-pnk-hoodie-9b06c66c01354f3a9ec914edd1604bcf', 'licence': 'CC BY 4.0', 'changes': 'All third-party print decals removed, jersey recoloured, decimated; BANDRIP graffiti added in a custom shader'},
    {'what': 'Mishu (footer skater)', 'author': 'ryanwheeler7321', 'url': 'https://sketchfab.com/3d-models/mishu-d81f585fe0e04869a8943f7bed423647', 'licence': 'CC BY 4.0', 'changes': 'Decimated and recoloured to the BANDRIP palette'},
    {'what': 'Street basketball characters (runway monument)', 'author': 'Tulio Portela', 'url': 'https://sketchfab.com/3d-models/v0-street-basketball-team-fashion-characters-367045f5fddc4f3a90fc15570fc72b40', 'licence': 'CC BY 4.0', 'changes': 'Decimated from 712k to 90k triangles and re-surfaced as untextured concrete (original kit graphics removed)'},
    {'what': 'Red Brick 03, Concrete Wall 003, Concrete Floor Worn 001', 'author': 'Poly Haven', 'url': 'https://polyhaven.com/textures', 'licence': 'CC0', 'changes': 'Wall and floor bases; graffiti sprayed on with the BANDRIP spray simulator'},
    {'what': 'Fonts: Anton, Space Grotesk, Space Mono, Saira Stencil One, Sedgwick Ave Display', 'author': 'Google Fonts contributors', 'url': 'https://fonts.google.com', 'licence': 'SIL OFL 1.1', 'changes': 'None'},
    {'what': 'Font: Permanent Marker', 'author': 'Font Diner', 'url': 'https://fonts.google.com/specimen/Permanent+Marker', 'licence': 'Apache 2.0', 'changes': 'None'},
]
