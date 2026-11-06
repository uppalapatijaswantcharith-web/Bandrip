# Reference analysis — BANDRIP prototype

Method: each site was opened in desktop Chrome (headless, real GPU via ANGLE/D3D11, 1440×900) and at 390×844 mobile. Scripts captured the entrance at 0.6/1.8/3.5/6.5/10 s, wheel-scrolled in steps so Lenis/ScrollTrigger timelines actually ran, moved the pointer, pressed/held gates, clicked controls, and recorded fonts, computed type, canvases and loaded libraries. Tools: `tools/refcapture.mjs`, `tools/refinteract.mjs`, `tools/scratch/refpass2.mjs`, `tools/scratch/refpass3.mjs`. Screens were reviewed as contact sheets (kept outside the repo).

**Observed** = seen in captures or read from the DOM. **Interpretation** = what we will do for BANDRIP. No source code, fonts, images or copy were taken from any reference.

User direction (mid-project): the homepage must follow DICH as closely as possible. DICH is therefore the blueprint for homepage structure, framing and interaction; the other references feed their assigned pages.

---

## 1. DICH Fashion — https://dich-fashion.webflow.io/ (homepage foundation)

### Observed
- **Stack**: Webflow + GSAP + ScrollTrigger + Lenis + SplitType + Three.js + Spline scenes (`spline-object scaleup2` in hero, `spline-object-mission`) + Unicorn Studio background + Swiper. Eight canvases on the page.
- **Gate**: black screen, `0 %` counter top centre, thin corner brackets, a ring button `<< DISCOVER >>` in the centre, mono "file system" readouts left and right (`C://SYSTEM_FILES … <ACCESS GRANTED>`), a single mono line at the bottom. Loader reached 100 % ~4 s. Entry is press-and-hold on the ring (ring fills with a gradient stroke). Text throughout starts as random capitals and resolves (scramble/decode).
- **Entry transition**: thin vertical bars/shutters sweep across black, then the hero is revealed (~0.8 s).
- **Persistent frame (HUD)**: the whole viewport sits inside a black bezel ~20 px thick with chamfered corners; a notched tab top-centre holds the section label (`DICH`, `DICH // COLLECTIONS`, `DICH // MISSION`, `DICH // PAST_DROP`, `DICH // GALLERY`, `DICH // BOTTOM`); a notched tab bottom-centre shows live pointer coordinates `X.0719 // Y.0436`. Small side ticks/arrows on left and right edges. Top-left: an audio waveform glyph + `ON`; top-right: `MENU`.
- **Hero**: full-bleed cloud image with a faint dot grid; a giant one-line headline (`FUTURE MODE OF DICH`, H1 ≈ 285 px, custom display face "T 012") runs as a slow horizontal marquee across the top third, letters overlapping the frame edge; tiny index tags (`G_009`, `G_021`, rotated `G_008`) are sprinkled around the letterforms. Two corner words (`NEW` bottom-left, `ERA` bottom-right) in the same display face. Mono micro-copy left (`+++ SHIFT THE VISION / EVOLVE`) and right (`TOUCH THE VOID / TRANSCEND`). Bottom centre: a black capsule button `DISCOVER` with a yellow chamfered end-cap containing `›››`.
- **Chapters**: full-bleed flat colour fields that swap per chapter: peach `#FFDFC4` (collections), lilac (mission/values), pink (drop), graphite (gallery), black (footer). Each chapter keeps the same frame and dot grid.
- **Collections chapter**: 3-column technical layout — left: mono spec lists (`STYLE-DNA: FUTURE-PLAYFUL`, `CODE-ESSENCE: CREATIVE CHAOS`) and a small diagonal "zoom" diagram; centre: a circular portrait (505 px canvas) inside a thin dotted rectangle with corner ticks; right: index number `.01` in large digits, the DISCOVER capsule, a short paragraph, a 4-up thumbnail strip `01–04`; bottom-left the collection name (`ORANITHS`) set huge.
- **Mission chapter**: `OUR MISSION` large, short paragraph right; a floating 3D rock with thin orbit rings drifts across while scrolling.
- **Values**: `.001 SUSTAINAB…`, `.002 SIRIUS`, `.003 ETERNITY` — numbered blocks that alternate left/right as you scroll, each with a small line icon.
- **Drop**: `DROP` centred inside bracket ticks; three overlapping circular portraits (large centre, two smaller sides) rising from the bottom.
- **Gallery**: graphite field, title top-left (`SIRIUS`), coordinates top-right, a hairline across, a horizontal line-up of full-length figures that slides sideways.
- **Footer**: black; `INTO THE FUTURE` title; giant outlined `DICH` built from horizontal scan-lines that warp under the pointer; credits in four columns; `SUBMIT_IDEA` capsule; `BACK TO TOP`.
- **Menu**: full-screen black overlay over a dimmed hero; centred numbered index `00. INDEX / 01. ORANITHS / 02. ANTURAX`, credits row beneath.
- **Mobile**: same gate and frame, reduced type, single column.
- The 3D "alien" figure lives in a Spline canvas in the hero; it did not finish rendering in our captures (Spline streams late), so its exact motion is **not observed**.

### DICH transitions — measured from frame bursts (`tools/scratch/dich_motion.mjs`, 1280×800, 40–60 ms per frame)
| Transition | Observed choreography and timing |
|---|---|
| Gate load | Percentage counts up in mono at top centre; side readouts decode from random capitals into words over ~1–2 s; ring button pulses faintly. |
| Hold to enter | Pressing the `DISCOVER` ring fills a thick conic gradient stroke around it (lilac→peach); release after full = enter. |
| Gate → hero | 0–180 ms ring collapses to a dot and gate text fades; ~300 ms thin vertical HUD grid lines draw; 360–950 ms the screen is a mosaic of black rectangles of varied height arranged in columns — a centre slit opens first, then blocks retract vertically, staggered outward; 1.0–1.15 s hairline outlines of the blocks linger, then vanish; 1.2 s hero complete inside the bezel with the marquee already running. |
| Hero idle | Headline marquee drifts left continuously (~1 glyph/s); 3D figure has small orbiting objects; pointer coordinates update in the bottom tab. |
| Hero → Collections | No pin. The next chapter slides up over the hero under Lenis inertia (~0.7 s settle). Hero photo stays as a band at the top edge. The big right-hand glyph decodes into `.01`. |
| Chapter colour change | Page background crossfades between flat fields (peach → lilac → peach/pink → graphite) as each chapter crosses mid-viewport, ~300–600 ms. |
| Heading reveal | Every large heading decodes letter by letter left→right from random glyphs (`OUR MIX`→`OUR MISSIH`→`OUR MISSION`) in ~600 ms on enter. |
| Mission object | A 3D rock with thin orbit rings enters bottom-right, drifts and rotates with scroll, overlaps the type. |
| Drop | `DROP` decodes inside bracket ticks; three circular portraits rise from the bottom with parallax (centre one larger, overlapping). |
| Gallery | Background to graphite; a row of full-length figures rises and slides sideways with scroll. |
| Footer | Mono side columns type on character by character; outlined scan-line word warps under the pointer. |
| Menu open | Page dims ~200 ms, black index overlay appears with two full-length figures flanking a centred numbered list that decodes in; ~550 ms total. Close reverses faster (~350 ms). |

### What we adapt (interpretation)
| DICH quality | BANDRIP implementation |
|---|---|
| Hold-to-enter gate with percentage and decode text | Gate with real asset-loading percentage; press-and-hold (or Enter/Space, or a "Skip" link) to enter; never blocks — auto-offers entry when loading stalls. |
| Shutter wipe | Vertical ink/red shutters (GSAP), 0.8 s. |
| HUD frame with notched tabs, live coordinates, section label | Same structural frame, original geometry (SVG), labels `BANDRIP // DROP_01`, coordinates readout, side ticks. |
| Marquee mega-headline with index tags | `BANDRIP — STREET UNIFORM —` marquee in Anton, index tags `B_001…` in mono. |
| Spline figure in hero | Our own 3D skull mascot (cap, sunglasses, bandana), Three.js, pointer response. |
| Colour-field chapters | BANDRIP chapters: chalk → signal red → concrete → ink → bone. |
| Collections tech layout (spec list / circle / index / thumbs / giant name) | Same grid for the five product families with real HTML, thumbnails switch the circle image with a liquid displacement. |
| Mission rock with orbits | The mascot itself travels between chapters (one WebGL context). |
| Numbered values `.001/.002/.003` | `.001 FIT / .002 FABRIC / .003 FACE` (plain-language brand principles, placeholders). |
| Drop circles | Three overlapping circular model portraits for "Runway preview". |
| Gallery line-up | Horizontal line-up of model photos leading into the Models page. |
| Outlined scan-line footer word | `BANDRIP` scan-line footer in WebGL-free SVG/canvas-2D with pointer warp. |
| Numbered menu overlay | `00. INDEX / 01. COLLECTIONS / 02. MODELS / 03. ABOUT / 04. LOOKBOOK / 05. STORES`. |

Not copied: DICH copy, collection names, cloud imagery, "T 012"/Druk/NB Architekt fonts (commercial), exact SVG frame paths, any code.

---

## 2. Lusion — https://lusion.co/ (motion direction)

### Access
- First two passes (headless Chrome, default headless user agent): `net::ERR_CONNECTION_CLOSED`. `curl` returned HTTP 200.
- Third pass with a regular desktop user agent loaded the site; 34 frames captured across load, pointer movement and 30 scroll steps. Observations below come from that pass.

### Observed
- Loader: black screen, a large counter `000 → 100` bottom-left, a white "L" glyph that assembles from two bars and scales up as the transition.
- Hero: a rounded-corner panel containing a dense 3D field of cross/jack-shaped objects (cobalt blue, white, black) that react to the pointer; thin nav (`LET'S TALK`, `MENU` pills) and `SCROLL TO EXPLORE`.
- "Bold Ideas, Brought to Life": a single thick 3D tube snakes across the copy as you scroll, linking sections (the "liquid" continuity).
- Play reel: a framed video card that scales up to fill the viewport as you scroll, then shrinks away.
- Featured work: two-column grid of large rounded cards with small tag lines and titles.
- Finale: background switches to black; a floating astronaut figure; the headline "STEP INTO A NEW WORLD AND LET YOUR IMAGINATION RUN WILD" breaks apart word by word, words flying outward as you scroll; then the camera dives into a glowing wireframe lattice tunnel with colour shifts and chromatic fringing.
- Same studio's Passerella (section 4) adds: depth of field, haze, film grain, eased camera paths.

### Interpretation for BANDRIP
- One persistent canvas per page; the hero object travels between sections instead of each section mounting its own scene (Lusion's snaking tube / astronaut role is played by the mascot, which leaves with the identity chapter and returns with orbit rings in the values chapter).
- Scroll drives camera paths with heavy easing and inertia (Lenis + scrubbed GSAP timelines), never linear jumps.
- Liquid continuity: velocity-aware image distortion on selected photos only, a displacement transition between collection images, and mesh deformation on hover in the category explorer.
- Grain overlay and restrained bloom-like glow, never neon.

---

## 3. Miu Miu Immersive Bags — https://immersivebags.miumiu.com/en/ (Collections page)

### Observed
- Navy intro card: `MIUMIU / PRESENTS / A HOUSE / THAT WE / S H A P E D` in Work Sans heavy caps with justified spacing, one-line invitation, a spinner that becomes an `Enter` button, sound prompt ("For an optimal experience please turn on your sound").
- After Enter: a photoreal room (painted red door, lamp, chair). Navigation is by clicking objects in the room — the camera moves through the house room by room; short captions appear ("Make room for imagination.", "Your vision is clear."). Pointer drag looks around slightly. Mute toggle bottom-right.
- Each room stages product in a coherent, physical world rather than a grid.

### Interpretation
- A BANDRIP "Depot": one 3D concrete space with seven plinths in an arc, one hero object per category (inflated tee, shirt, jacket, cargo pants, cap, sunglasses, bandana).
- Hover/focus: object lifts, rotates, label decodes; click/Enter: camera dollies into the object, the space washes to the category colour, and an HTML gallery rises over it.
- Each category has its own URL (`/collections/<slug>/`) so browser Back returns to the explorer; an accessible list of categories sits alongside the canvas.
- Original world: concrete, chalk tape marks and stencilled numbers — nothing from Miu Miu's house or branding. No sound (audio off by default, none shipped).

---

## 4. Infinite Passerella — https://exp-infinite-passerella.lusion.co/ (Models page)

### Observed
- Loader with lit spheres (stalled ~20 % for a long time on first visit, then loaded in ~5 s on a warm cache).
- Scene: dark industrial hall with lighting truss; long runway whose floor is an LED surface with flowing two/three-colour blob patterns that change; rows of semi-transparent, softly lit audience silhouettes; a model walks out of a bright doorway toward camera.
- Camera: starts behind/low at the runway head, then cuts to side views; pointer moves the camera; drag orbits in "free view". Depth of field blurs crowd.
- UI: `LUSION | LABS`, title `INFINITE PASSERELLA` with very wide tracking, controls `CAMERA VIEW / FREE VIEW / CHANGE LED LIGHTS / TAKE A SNAPSHOT`, About drawer.

### Interpretation
- BANDRIP Studio runway: dark hall, runway with a signal-red/chalk LED pattern shader, haze, truss lights, instanced audience silhouettes (one draw call), walking models (licensed rigged characters if obtainable; otherwise an honest editorial photo-plane fallback).
- Controls kept small: `VIEW: FRONT / SIDE / FREE`, `LIGHTS`, `PAUSE`. No snapshot feature.
- Below the scene: studio intro, styling, recruitment and training (marked as client-confirmable), portfolio, application form.

---

## 5. NORBLACK NORWHITE — https://norblacknorwhite.in/ (supporting pages)

### Observed
- Fonts: Albert Sans (UI), Helvetica, Bebas Neue/Pathway Gothic for display.
- Top marquee strip in black with emoji separators; logo left, Shop/About left, Lookbooks/Universe right, icon cluster.
- Home: full-bleed photographic banners with very large overlaid type ("AUNTIES FOREVER", "GIFT SHOP FOR EVERYONE"); product rows in hairline-ruled 4-column grids with small caps names and prices; "SOLD OUT" round badges.
- About: centred statements in a light display weight — "Respect the Past / Question the Present / Create for the Future" — each followed by a short centred paragraph; press list "Extra Extra, Read All About Us!" in multi-column caps; "Get in Touch".
- Lookbook ("Back To The Future"): split screen — photograph left, solid electric-blue panel right with title, short story and shoot credits list (photography, styling, models, hair & make-up).
- Universe (journal): three-column cards, image + uppercase title, pagination.
- Black footer with emblem, newsletter, three link columns. A phone-signup modal appears on first visit.

### Interpretation
- About: three large statement blocks (in our Anton) with short paragraphs, plus a studio timeline marked "to confirm".
- Lookbook / Community: split-screen look stories with solid colour panels and credit lists (credits = photo credits of the filler images), then a community wall in a 3-column ruled grid.
- Stores / Contact: ruled store directory (placeholder addresses clearly labelled), contact form demo, map-free typographic layout.
- Same hairline-ruled product grid style inside collection galleries for readable item details.
- We do not use a first-visit modal or emoji separators (BANDRIP uses mono glyph separators instead).
