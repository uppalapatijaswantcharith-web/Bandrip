# Page and motion plan — BANDRIP

All pages share: HUD frame, MENU overlay (numbered index), mosaic page transition, Lenis scroll, decode labels, reduced-motion and no-WebGL paths. One WebGL canvas per page, mounted only where it is needed.

## Routes
| URL | Page | Reference |
|---|---|---|
| `/` | Home | DICH (structure, frame, transitions) + Lusion (fluid 3D) |
| `/collections/` | Depot — category explorer | Miu Miu |
| `/collections/<slug>/` | Category gallery (deep link, Back works) | Miu Miu + NORBLACK grid |
| `/models/` | Studio — runway + recruitment + form | Infinite Passerella |
| `/about/` | About | NORBLACK about |
| `/lookbook/` | Lookbook / Community | NORBLACK lookbooks + journal |
| `/stores/` | Stores / Contact | NORBLACK footer/contact |
| `/models/apply/` (POST) | Demo form endpoint (JSON) | — |

## Global transitions
| Moment | Choreography | Duration |
|---|---|---|
| First visit gate | Ink screen, `%` counter of real assets, side readouts decode, `HOLD TO ENTER` ring fills a conic red→chalk stroke while pressed (keyboard: hold Space/Enter; also a `SKIP` link). If assets are done and nobody acts within 4 s, the ring pulses; there is never a wait beyond the loader | ≤ asset load |
| Gate → page | Ring collapses (180 ms) → HUD grid lines draw (120 ms) → 8 columns × 3–5 ink blocks retract vertically, centre-out stagger 40 ms (650 ms) → block outlines fade (150 ms) | ~1.1 s |
| Page → page | Same mosaic, in reverse to cover (450 ms), navigate, then reveal on the new page (650 ms). Repeat visits skip the gate (sessionStorage) | ~1.1 s |
| Headings | Decode left→right, 30 ms per glyph, random set `A–Z0–9/_` | 450–650 ms |
| Chapter fields | Background colour tween on chapter centre crossing | 400 ms |
| Menu | Page dims (200 ms) → ink overlay → index lines decode staggered 60 ms; two model cut-outs fade in at sides | 550 ms; close 350 ms |
| Reduced motion | Gate becomes a single Enter button; mosaic → 200 ms fade; decode off; marquee static; 3D static pose | — |

## Home (`/`) — chapter sequence
| # | Chapter (top tab label) | Field | Content | Motion |
|---|---|---|---|---|
| 0 | Gate | Ink | `%`, side readouts, hold ring, bottom line `TURN IT UP. THE STREET IS LISTENING.` | See above |
| 1 | `BANDRIP` hero | Red haze shader over chalk | Marquee `BANDRIP — STREET UNIFORM — BANDRIP —` with index tags; mascot centre; left micro `+++ CUT LOOSE / DROP_01`; right `WEAR IT LOUD / STUDIO OPEN`; corner words `STREET` / `UNIFORM`; capsule `ENTER THE DEPOT` + mono link `WALK THE RUNWAY` | Marquee drift; mascot idle bob + pointer look (±12°); haze flows; coordinates live |
| 2 | `BANDRIP // IDENTITY` | Chalk | Huge statement `CUT FOR THE STREET. FITTED IN THE STUDIO.` + two large photographs layered (one in the frame, one overlapping the bezel) | Scrubbed: mascot shrinks and flies to the right third, rotating 35°; camera dolly; photos rise at different speeds (parallax 0.85/1.15); statement decodes |
| 3 | `BANDRIP // MODELS` | Concrete | Overlapping editorial composition: 1 tall portrait, 2 offset crops, 1 landscape strip, captions in mono | Images reveal via clip-path wipes in different directions; velocity distortion on the landscape strip |
| 4 | `BANDRIP // COLLECTIONS` | Chalk | DICH collections layout ×5 (tees, shirts, outerwear, pants, accessories) inside a pinned chapter: left spec list, centre disc photo, right `.0N`, capsule, paragraph, 4-up thumbs; bottom-left category name huge | Pinned ~300 vh; each step: name decodes, disc swaps with liquid displacement, index flips, thumbs re-order; mascot sits small top-right wearing the current item's colour accent |
| 5 | `BANDRIP // VALUES` | Signal red | `.001 FIT`, `.002 FABRIC`, `.003 FACE` alternating sides | Each decodes on enter; mascot drifts across with orbit rings (the DICH "rock" role) |
| 6 | `BANDRIP // RUNWAY_PREVIEW` | Graphite | `RUNWAY` in bracket ticks, three overlapping circular portraits rising, then a horizontal line-up of full-length photos | Circles rise with parallax; line-up translates sideways with scroll + velocity skew |
| 7 | `BANDRIP // BOTTOM` | Ink | `INTO THE STREET` title; outlined scan-line `BANDRIP` (2D canvas, warps under pointer); three exits: Collections / Studio / Contact; credits columns type-on | Scan-lines bend toward pointer; mono columns type on |

The mascot is the only 3D object on Home and it travels through chapters 1→2→4→5 (one renderer, rendering paused when off-screen beyond chapter 5).

## Collections (`/collections/`) — Depot
- **Scene**: concrete floor and back wall, chalk tape lines, seven plinths in a shallow arc, each with an inflated hero object: oversized tee, shirt, jacket, cargo pants, cap, sunglasses, bandana. Stencilled numbers `01–07` on plinth faces. Soft key light, red practical strip at the back.
- **Idle**: objects turn slowly at different speeds; camera drifts with the pointer (±3°).
- **Hover/focus** (mouse ray or keyboard focus on the matching HTML list item): object lifts 6 cm, label above it decodes, others dim 20 %.
- **Select** (click/tap/Enter): camera dollies to the object (1.1 s `power3.inOut`), object spins once, field washes to the category colour, the HTML gallery slides up; URL becomes `/collections/<slug>/` via `history.pushState`.
- **Gallery**: header with category name + count; editorial ruled grid with varied spans (1×2 tall, 2×1 wide, 1×1); each item = image, name, fabric/fit notes marked DEMO; click opens a detail view (large image + details, arrows, Esc).
- **Return**: `← BACK TO DEPOT` button, Esc, or browser Back → camera returns to the arc; state restored from URL on load (deep links work, no-JS renders the gallery server-side).
- **Accessible list**: a visible list `01 OVERSIZED TEES … 07 BANDANAS` on the left drives the same transitions.

## Models (`/models/`) — Studio
- **Runway scene**: dark hall, long runway with an LED floor shader (signal red / chalk / graphite flowing shapes, cycle with `LIGHTS`), haze planes, truss with spot cones, instanced audience silhouettes (one InstancedMesh), walking models looping toward camera.
- **Camera**: `FRONT` (head of runway, slow push), `SIDE` (tracking), `FREE` (drag orbit with limits). Pointer adds ±2° parallax.
- **Controls**: `VIEW`, `LIGHTS`, `PAUSE` (mono buttons, keyboard accessible).
- **Below**: Studio intro → Styling & self-expression → Recruitment & training (CONFIRM-WITH-CLIENT box) → Portfolio gallery (filter by look) → `BECOME A BANDRIP MODEL` form.
- **Form**: name, email, city, age confirmation (18+ checkbox), height (optional), Instagram/portfolio URL (optional), experience (none/some/professional), why (textarea, 20–600 chars), consent checkbox. Client + server validation, inline errors, `aria-live` summary. Success state: `PROTOTYPE — NOTHING WAS SENT` panel.

## Supporting pages
- **About**: hero split (photo + red field), three statements `CUT FOR THE STREET / BUILT IN THE STUDIO / WORN BY YOU` with short paragraphs, studio facts table marked placeholder, closing exits.
- **Lookbook / Community**: three look stories (split screen: photo left, colour panel right with title, notes, credits = photographers), then a ruled 3-column community wall with mono captions.
- **Stores / Contact**: placeholder store directory (ruled rows: city, address, hours — all labelled placeholder), contact form demo, socials as plain links (placeholder handles).

## 3D choreography (Home mascot keyframes, scroll progress p ∈ chapters)
| Key | Position (x,y,z) | Rot Y | Scale | Camera z | Notes |
|---|---|---|---|---|---|
| Hero | (0, −0.05, 0) | pointer ±12° | 1.0 | 4.2 | Entrance: rises from y −0.6, scale 0.86→1, 1.2 s after mosaic |
| Identity | (1.25, 0.15, −0.4) | −35° | 0.62 | 4.6 | Scrubbed between chapters 1→2 |
| Models | off right (3.2, 0.2, −1) | −60° | 0.5 | — | Exits; render paused while hidden |
| Collections | (1.35, 0.9, −0.5) | −20° | 0.38 | 4.6 | Small, top-right of the pinned chapter |
| Values | path across (−1.6→1.6, 0→0.3) | 0→180° | 0.7 | 4.4 | Orbit rings drawn as two thin tori |
| Runway onward | hidden | — | — | — | Renderer idles (no RAF) |


## Update — BANDRIP-specific motion (replacing the DICH replicas)
| Moment | Now | Why |
|---|---|---|
| Opening | Spray the BANDRIP stencil on a graffiti brick wall: the can follows the pointer (or sweeps by itself on hold/Enter), paint goes through the stencil with real overspray, coverage completes the tag, drips run. A paint gauge shows real asset loading. Skip and a 12 s fallback always work | DICH's hold-ring gate read as a copy; a spray can is BANDRIP's own gesture |
| Page change | Wet paint runs down in columns with bulb-tipped drips, then drains off the bottom to reveal | Replaces the DICH block mosaic |
| Hero | GPU smoke simulation stirred by the cursor; holding the mouse sprays red paint into the flow; ambient plumes keep it alive | "Dynamic background with flow on cursor" |
| Between chapters | Each chapter's colour drips into the next; drip length is scrubbed by scroll | Liquid continuity that is also graffiti |
| Identity | A tag is sprayed across the concrete wall as you scroll (seeded particles, so scrolling back un-sprays it); the can rides the nozzle | Innovative scroll, on-brand |
| THE DROP (new, pinned) | A blank BANDRIP hoodie rotates while scroll sprays graffiti onto it (shader spray front with speckled overspray); the can tracks the front and emits paint particles; a paint meter fills | The signature scroll moment |
| Footer | The skater rolls in along the top of the scan-line BANDRIP box | Brings the community into the end frame |
