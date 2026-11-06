# Anti-generic design rules — BANDRIP

Generic AI-built sites share a recognisable kit. Each pattern below has a concrete rule for this project and a check we run before calling a page done.

| Generic pattern | BANDRIP rule | Check |
|---|---|---|
| Centred hero: headline, subline, two pill buttons, gradient behind | Hero = framed HUD, edge-to-edge marquee cropped by the bezel, mascot centre, micro-type in corners, one capsule action | Headline touches both bezel edges at 1440 px |
| Rows of identical rounded cards with icon + title + 2 lines | No cards. Content sits on hairline rules, in circles, or as cropped photographs. Corner radius only for circles and the capsule | `border-radius` appears only on `.disc`, `.capsule`, `.hold-ring` |
| Three-column "features" grid | Values are numbered statements (`.001 / .002 / .003`) that alternate sides as you scroll | No section has three equal columns of equal content |
| Gradient blobs, mesh gradients | Flat colour fields per chapter; the only gradient is the red haze shader in the hero, which is motivated (smoke) | No `radial-gradient` decoration in CSS |
| Glassmorphism | None. Overlays are opaque ink or chalk | No `backdrop-filter` blur on panels |
| Neon glows | No glows on type or UI | No coloured `box-shadow`/`text-shadow` |
| Everything fades up on scroll | Each motion type has a job: decode = labels/headings, mosaic = page change, crossfade = chapter, rise = photography, scrub = 3D | Count reveal types per page ≥ 3, and no single type on > 50 % of elements |
| Emoji icons | Mono glyphs (`+++`, `›››`, `//`, `→`) and SVG line marks | No emoji in templates |
| Vague copy ("Elevate your style", "Unleash your potential") | Short, concrete lines about fit, fabric and the studio. Banned words: elevate, unleash, redefine, seamless, journey, curated, next-level | grep the templates for the banned list |
| Fake proof (testimonials, "trusted by", stats) | None. Recruitment, training and addresses are labelled `PLACEHOLDER — CONFIRM WITH BANDRIP` | grep for "testimonial", "%", "trusted" |
| Unreadable experimental type | Experimental type is decoration only; every actionable label exists as plain readable HTML ≥ 12 px | Lighthouse a11y + manual read |
| Effects hiding the product | Displacement only during transitions or hover; at rest every garment is clear and undistorted | Screenshot each gallery at rest |
| Default "Shop now" CTAs everywhere | Actions name the destination: `ENTER THE DEPOT`, `WALK THE RUNWAY`, `APPLY TO THE STUDIO`, `FIND A STORE` | Read every button aloud |
| Pills everywhere | One button form: the capsule (label + red end-cap with `›››`). Secondary actions are underlined mono links | Only `.capsule` has rounded ends |
| Stock spinner loaders | The gate shows a real percentage of real assets and can be skipped; nothing traps the visitor | Gate never shows longer than 6 s; Skip is focusable |

## Copy voice
- Short sentences, present tense, specific nouns (heavyweight jersey, drop shoulder, ripstop, 240 GSM — marked as placeholder specs).
- Micro-type may be playful (`FIT_CHECK: PASSED`), body copy may not.
- Never claim inventory, prices or placements as real. Demo prices are omitted or marked `DEMO`.
