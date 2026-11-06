# Implementation plan — BANDRIP prototype

## Architecture
```
bandrip/            Django project (settings, urls)
web/                Django app: views, forms, demo content, context processor, vite tag
  content.py        Structured demo data (categories, items, looks, stores) — all marked demo
  data/photos.json  Graded photo catalogue + credits (generated)
templates/          base.html (frame, menu, transition layer), partials/, pages/
frontend/           Vite source
  main.js           Boot: fonts, Lenis, router for page modules, transitions
  core/             lenis-gsap bridge, renderer (one WebGL context), loader, viewport, a11y prefs
  ui/               frame (HUD + coordinates), menu, gate, mosaic transition, decode text, marquee, capsule
  pages/            home.js, depot.js, models.js, about.js, lookbook.js, stores.js
  scenes/           mascot-scene.js, depot-scene.js, runway-scene.js, shaders/
  styles/           tokens.css, base.css, frame.css, pages/*.css
static/             dist/ (Vite build), img/, models/, draco/
tools/              asset pipelines (photos, mascot, depot, walker), research + verify scripts
```

- **Pages are multi-page Django routes.** A page's root element carries `data-page="home|depot|models|…"`; `main.js` imports that page module dynamically, so Three.js only loads where needed.
- **Transitions between pages**: internal links are intercepted; the mosaic covers, `location` changes, the next page reveals. `pageshow` (bfcache) resets the cover. Real `<a href>` everywhere so no-JS navigation works.
- **One WebGL context per page** (`core/renderer.js`): DPR capped at 1.75 desktop / 1.25 mobile; render loop pauses on `visibilitychange`, when the canvas is off-screen (IntersectionObserver), and when the page module says the scene is idle. `dispose()` walks the scene and frees geometry/material/texture on navigation.
- **Lenis + ScrollTrigger**: Lenis drives `ScrollTrigger.update`; GSAP ticker drives Lenis; reduced motion disables Lenis smoothing.
- **Category deep links**: `/collections/<slug>/` is a real Django route rendering the same template with that gallery open (works without JS); JS uses `pushState`/`popstate` to move between explorer and gallery without reloads.
- **Form**: Django `ModelApplicationForm` validates; the endpoint returns JSON for fetch and an HTML page without JS. Nothing is stored or sent.
- **Fallbacks**: WebGL check → `html.no-webgl` → poster images and CSS layouts; `prefers-reduced-motion` → `html.reduced-motion`.

## Dependencies
Python: Django 5.2 (runtime). Pillow, numpy, scikit-image, trimesh (asset pipelines only).
Node: three 0.170, gsap 3.12, lenis 1.1, @fontsource/{anton,space-grotesk,space-mono}; dev: vite 5, playwright.
Tools: Blender 5.2.3 (asset pipelines only).

## Build phases
1. **Foundation**: Django routes/templates, Vite pipeline, tokens, frame, menu, gate, mosaic, decode, Lenis. Verify navigation and fallbacks.
2. **Mascot**: SDF sculpt → Blender finish → GLB + poster; hero scene (haze, lights, pointer, entrance). Verify in browser screenshots.
3. **Home sequence**: chapters 2–7, mascot keyframes, colour fields, collections pinned chapter with liquid disc swap, runway preview, footer scan-lines.
4. **Depot**: garment models → scene, picking, camera moves, galleries, history, accessible list.
5. **Studio**: walker model, runway scene, controls, content, form (client + server validation).
6. **Supporting pages**: About, Lookbook/Community, Stores/Contact.
7. **Responsive, performance, accessibility pass**: mobile layouts, DPR, lazy loading, keyboard paths, reduced motion, no-WebGL.

## Verification (`tools/verify.mjs`, Playwright + system Chrome with GPU)
- Visit every route at 1440×900 and 390×844; collect console errors and failed requests; screenshot.
- Gate: hold, keyboard and Skip paths reach the page; repeat visit skips the gate.
- Navigation via menu and in-page links; browser Back/Forward between depot and galleries.
- Category select → gallery → back, by mouse and keyboard.
- Form: empty submit shows errors; valid submit shows the prototype success state.
- `prefers-reduced-motion` emulation and a forced no-WebGL run (`--disable-webgl`).
- Performance: frame-time sampling via `requestAnimationFrame` deltas over 5 s per 3D page, JS heap, transferred bytes. Report measured numbers only.
