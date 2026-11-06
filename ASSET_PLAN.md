# Asset plan — BANDRIP prototype

Everything below is **temporary** unless marked otherwise. Nothing here is presented as confirmed BANDRIP inventory, people or locations.

## Brand assets (supplied by the client)
| Asset | File | Status |
|---|---|---|
| Skull logo reference (150×150 JPG) | `brand_supplied/logo-skull-reference.jpg` | Low-res reference only. Not used on the site; needs a vector original. |
| Lookbook screenshot ("BANDRIP" wordmark, "Arrivals") | `brand_supplied/lookbook-arrivals-reference.png` | Reference for wordmark mood only. Not used on the site. |
| Official logo / wordmark (vector) | — | **Missing.** The site sets "BANDRIP" in Anton until supplied (one template partial: `templates/partials/wordmark.html`). |

## Photography (temporary filler)
- **Source**: Pexels, **Pexels License** (free for commercial use, no attribution required; cannot be sold unaltered or implied as endorsement). Credits are kept anyway.
- **Selection**: 40 photos covering tees, shirts, outerwear, pants/cargos, caps, sunglasses, bandanas and studio/model shots. Frames showing third-party logos (Yankees, Amiri, The North Face, slogan caps) and formal runway eveningwear were rejected.
- **Pipeline**: `tools/photos_manifest.py` (list + credits) → curl from the Pexels CDN at 1800 px → `assets_src/photos/` → `tools/process_photos.py` (one grade, 800w + 1600w WebP, 24 px placeholder, average tone) → `static/img/photos/` + `web/data/photos.json`.
- **Credit status**: 29 credits read on the photo page; 11 taken from the search listing and flagged `credit_verified: false` in `photos.json`.
- Search route: Unsplash blocks automated browsers ("Access Denied") and its API needs a key, so it was not used. Pexels search pages also block automation; photo pages were found through web search and read individually.
- Full inventory with photographer and URL: `web/data/photos.json` (rendered on `/about/#credits`).

## 3D assets (created for this project)
| Asset | File | Method | Status |
|---|---|---|---|
| Hero mascot: skull + cap + sunglasses + bandana | `static/models/mascot.glb` | Python SDF sculpt (`tools/mascot/build_mascot.py`, numpy + scikit-image marching cubes) → Blender 5.2 headless finish (`tools/mascot/blender_finish.py`): teeth, smoothing, decimation, AO bake to vertex colours, materials, Draco export | Temporary interpretation of the supplied logo — **not the official logo** |
| Mascot poster (instant paint while GLB loads) | `static/img/mascot-poster.webp` | Cycles render of the same model and camera | Temporary |
| Depot objects ×7 (tee, shirt, jacket, cargo pants, cap, sunglasses, bandana) | `static/models/depot.glb` | Inflated-garment modelling from 2D pattern outlines (distance-field "pillow" profile), seams and pockets as grooves, Blender finish | Temporary, stylised |
| Runway mannequins (rigged, walking) | `static/models/walker.glb` | SDF body + streetwear layers, Blender armature, automatic weights, keyframed runway walk cycle | Temporary, stylised (faceless mannequins, not realistic humans) |
| Bandana paisley texture | `static/img/tex/bandana.webp` | Procedural (Python/PIL) | Original |
| Cap patch, fabric normal | `static/img/tex/*.webp` | Procedural | Original |
| Runway LED floor, hero haze | GLSL in `frontend/scenes/` | Procedural shaders | Original |

### Rigged human models — decision
Evaluated licensed options: Quaternius "Animated Human" (CC0; cartoon low-poly, wrong tone for fashion) and Khronos CesiumMan (CC BY 4.0 with a trademarked texture; test asset look). Mixamo requires an Adobe login and restricts redistribution. **Chosen**: original stylised mannequins built and animated in Blender. They are honest about being mannequins, so we do not present them as realistic models. If BANDRIP later supplies scanned or licensed characters, `walker.glb` is a drop-in replacement (same bone names are not required — the runway reads any GLB's first animation clip).

## Fonts (self-hosted, all SIL Open Font License)
Anton, Space Grotesk, Space Mono — via Fontsource npm packages, bundled by Vite.

## Libraries
three (MIT), gsap (GreenSock standard licence, free incl. ScrollTrigger), lenis (MIT), Django (BSD), Vite (MIT), Playwright (Apache-2.0, dev only).

## What the client must supply before launch
Vector logo and wordmark; real product photography and names; confirmed copy for recruitment/training; store addresses, hours, contact email, social handles; photo/model releases for any people shown.


## Update — street layer and client-supplied models

### Client-supplied 3D models (Sketchfab, all CC BY 4.0, credited on /about/#credits)
| Model | Author | Used for | What we changed |
|---|---|---|---|
| Cowboy Hat | MadeByYeshe | Mascot (matches the logo) | Black felt recolour; scaled and seated on the skull |
| Bandana Mask | Tactical_Gamer | Mascot | Subdivided, shrink-wrapped "outside" onto the skull |
| Sp5der P*NK Hoodie | Harrison.Clayton | THE DROP | **All Sp5der print decals deleted** (third-party brand art), jersey recoloured to ink, decimated; BANDRIP graffiti sprayed on by a shader |
| Mishu | ryanwheeler7321 | Footer skater | Decimated, BANDRIP colourway, toon outline shells kept as back-face hulls |
| v0 Street Basketball Team | Tulio Portela | Runway monument | Decimated 712k → 90k; untextured concrete bake, which removes the "V0" kit graphics |
| Creative Commons Cap | wa_rouk | **Not used** | Sketchfab Standard licence, not CC BY, and not requested |

### CC0 materials (Poly Haven)
`red_brick_03`, `concrete_wall_003`, `concrete_floor_worn_001` (1k colour/normal/roughness). The `wide_street_01` HDRI was downloaded for evaluation but not shipped (RoomEnvironment reflections were enough, saving 1.4 MB).

### Made for BANDRIP
- Spray-paint simulator and graffiti kit (`tools/graffiti/`): throw-ups, tags, stencils (including the supplied skull logo), doodles, stickers, tape, composited walls.
- Spray can (Blender lathe model with a printed BANDRIP label).
- Hoodie graffiti layout (`static/img/graffiti/hoodie_graffiti.webp`).
