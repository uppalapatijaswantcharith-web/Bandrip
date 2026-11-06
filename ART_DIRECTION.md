# Art direction — BANDRIP

**One line:** a streetwear label broadcast through a HUD. The homepage follows DICH's framed, chaptered, decoding interface; BANDRIP's skull mascot, red haze and street photography make it unmistakably ours.

## Visual system
- **Frame (HUD).** Every page lives inside an ink bezel (16–20 px desktop, 10 px mobile) with chamfered corners, a notched tab top-centre (section label, e.g. `BANDRIP // DROP_01`) and a notched tab bottom-centre (live `X.0000 // Y.0000` pointer readout; on touch it shows scroll progress). Side ticks mark the vertical centre. Original SVG geometry.
- **Chapters.** Full-bleed flat colour fields, one per chapter, crossfaded on scroll. A faint dot grid (1 px dots, 24 px pitch, 8 % ink) sits on every light field.
- **Micro-type.** Mono labels in caps with `+++`, `//`, `_` separators and index tags (`B_014`). They frame the composition; they never carry essential information alone.
- **Mega-type.** Display words run edge to edge, cross the bezel and get cropped by it.

## Palette
| Token | Hex | Use |
|---|---|---|
| Ink | `#151515` | Frame, gate, footer, text on light fields |
| Chalk | `#F2F0E9` | Primary light field, text on dark |
| Signal red | `#E63228` | Brand chapter field, capsule end-caps, mascot bandana, focus rings |
| Concrete | `#A9A59C` | Values chapter, secondary surfaces |
| Graphite | `#2A2927` | Gallery / runway chapter |
| Bone | `#E4DCCB` | Mascot skull, warm highlight in photography |
| Haze | `#F6C9B8` | The red smoke in the hero haze shader (at its thinnest) |

Rules: red is a field or a marker, never a gradient blob. No neon, no glows on UI. Text contrast ≥ 4.5:1 for body (ink on chalk, chalk on graphite/ink; chalk on signal red only at ≥ 24 px bold).

## Typography
- **Display: Anton** (OFL) — giant marquee, chapter names, category names. Uppercase, tracking 0 to −1 %, line-height 0.85.
- **Text: Space Grotesk** (OFL) — paragraphs, product details, forms. 15–18 px, line-height 1.45.
- **Utility: Space Mono** (OFL) — HUD labels, coordinates, indexes, buttons. 10–12 px caps, tracking +4 %.
- Self-hosted woff2 via Fontsource; `font-display: swap`; Anton preloaded.
- DICH's display face (T 012) is commercial and is not used. Anton gives the same edge-to-edge mass with a streetwear accent.

## Composition rules
1. Desktop 12-column grid inside the frame, 24 px gutters; mobile 4 columns.
2. Each chapter has one dominant element: mega-type, the mascot, or one photograph. Everything else is micro-type and hairlines.
3. Asymmetry: technical left column, dominant centre, index and action right (DICH collections layout).
4. Hard edges everywhere. Radius is used only for true circles (portrait discs, the hold ring) and the capsule button.
5. Images are cropped hard: heads may be cut at the bezel, garments never hidden behind type.

## Photography treatment
- Temporary Pexels images, graded together (`tools/process_photos.py`): ~14 % desaturation, gentle S-curve, blacks lifted to ink and whites warmed to chalk, fine mono grain.
- Shown in three formats: **circle** (discs, DICH style), **full-length cut** (gallery line-up, portrait), **ruled grid** (collection galleries, NORBLACK style).
- On light fields images get a 1 px ink keyline; on dark fields none.
- Liquid displacement only on (a) collection disc image swaps, (b) the gallery line-up under fast scroll, (c) category gallery hover. Clothing must remain readable at rest.

## Mascot
A bone-white skull wearing a black six-panel cap (red under-brim, small woven "B" patch), wrap sunglasses and a signal-red paisley bandana pulled down around the jaw. Lit like a product shot: warm key from top-left, red rim from behind-right, soft fill. It is a **temporary interpretation** inspired by the supplied skull logo and is easy to swap (`static/models/mascot.glb`).

## Motion language (summary — detail in PAGE_AND_MOTION_PLAN.md)
- **Decode** for headings and labels: random glyphs resolve left→right, 450–650 ms.
- **Mosaic shutter** for gate→hero and page→page: column blocks retract, staggered from the centre, about 1 s.
- **Crossfade** of chapter colour fields, 400 ms, scroll-triggered.
- **Inertia**: Lenis smooth scroll (lerp 0.1); 3D follows scroll with damping, not 1:1.
- **Easing**: `expo.out` for entrances, `power3.inOut` for camera moves, `power2.in` for exits.
- **Reduced motion**: no shutter (simple fade), no marquee, no decode (text appears), static camera.
