// Home: DICH-structured chapters made BANDRIP: live smoke hero, travelling mascot, scroll-sprayed tag,
// paint-drip chapter edges, THE DROP (spray-tag a hoodie by scrolling) and a skater in the footer.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { decode, decodeTo } from '../ui/decode.js';
import { scanWord } from '../ui/scanword.js';
import { sprayReveal } from '../ui/sprayreveal.js';
import { dripEdges } from '../ui/dripedges.js';

export async function init({ prefs, smooth, loader }) {
  const cleanups = [];
  const stats = {};

  // --- critical images count toward the gate percentage
  const heroImg = document.querySelector('.hero__bg img');
  const poster = document.querySelector('.hero__poster');
  loader.image(heroImg, 2);
  loader.image(poster, 1);

  // --- 3D mascot (one context for the whole page)
  let mascot = null;
  let rt = null;
  const canvas = document.querySelector('[data-stage]');
  if (prefs.webgl && canvas) {
    const setGlb = loader.add(5);
    try {
      const [{ createRenderer }, { createMascotScene }] = await Promise.all([
        import('../core/renderer.js'),
        import('../scenes/mascot.js'),
      ]);
      rt = createRenderer(canvas, { alpha: true });
      mascot = await createMascotScene(rt, { onProgress: setGlb, mobile: prefs.mobile });
      setGlb(1);
      rt.start((dt, t) => mascot.frame(dt, t));
      document.documentElement.classList.add('webgl-ready');
      stats.renderer = rt.stats;
    } catch (err) {
      console.warn('[bandrip] 3D unavailable, poster fallback in use', err);
      setGlb(1);
      document.documentElement.classList.add('no-webgl');
    }
  }

  // --- hero smoke: GPU fluid stirred by the cursor; holding the mouse sprays red paint into it
  const fluidCanvas = document.querySelector('[data-fluid]');
  const hero = document.querySelector('.hero');
  if (prefs.webgl && fluidCanvas && !prefs.reduced) {
    try {
      const { createFluid } = await import('../scenes/fluid.js');
      const tall = window.innerWidth / window.innerHeight < 0.8;
      const fluid = createFluid(fluidCanvas, { bgUrl: document.querySelector(tall ? '.hero__bg source' : '.hero__bg img')?.getAttribute(tall ? 'srcset' : 'src'), mobile: prefs.mobile });
      if (fluid) {
        loader.track(fluid.ready, 1);
        fluid.ready.then(() => document.documentElement.classList.add('fluid-ready'));
        let heroVisible = true;
        new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
        const fTick = (time, deltaMs) => { if (heroVisible && document.visibilityState === 'visible') fluid.frame(deltaMs / 1000); };
        gsap.ticker.add(fTick);
        cleanups.push(() => { gsap.ticker.remove(fTick); fluid.dispose(); });
        const pos = (e) => { const r = fluidCanvas.getBoundingClientRect(); fluid.pointer((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height); };
        hero.addEventListener('pointermove', pos);
        hero.addEventListener('pointerdown', (e) => { if (e.target.closest('a, button')) return; pos(e); fluid.press(true); hero.classList.add('is-spraying'); });
        window.addEventListener('pointerup', () => { fluid.press(false); hero.classList.remove('is-spraying'); });
        new ResizeObserver(() => fluid.resize()).observe(fluidCanvas);
      }
    } catch (err) {
      console.warn('[bandrip] fluid hero unavailable, static haze in use', err);
    }
  }

  // --- the street layer: scroll-sprayed tag, paint dripping between chapters
  const tagEl = document.querySelector('[data-spray-reveal]');
  if (tagEl) sprayReveal(tagEl, { trigger: '.identity', start: 'top 70%', end: 'center 30%', reduced: prefs.reduced });
  dripEdges(document, { reduced: prefs.reduced });

  // --- hero marquee: constant drift + scroll velocity
  const track = document.querySelector('.marquee__track');
  if (track && !prefs.reduced) {
    let x = 0;
    const item = track.firstElementChild;
    const tick = (time, deltaMs) => {
      const w = item.offsetWidth || 1;
      const v = Math.abs(smooth.velocity || 0);
      x -= (0.045 + Math.min(v, 60) * 0.012) * deltaMs;
      if (x <= -w) x += w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  // --- identity parallax
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const f = parseFloat(el.dataset.parallax);
    if (prefs.reduced) return;
    gsap.fromTo(el, { y: (1 - f) * -260 }, { y: (1 - f) * 260, ease: 'none', scrollTrigger: { trigger: el.closest('.chapter'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // --- clip-path reveals (directional, not a generic fade-up)
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -15% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el, i) => { el.style.transitionDelay = `${(i % 5) * 90}ms`; io.observe(el); });

  // --- velocity skew on selected images (liquid continuity)
  const vel = [...document.querySelectorAll('[data-velocity]')];
  if (vel.length && !prefs.reduced) {
    let sk = 0;
    const tick = () => {
      const target = gsap.utils.clamp(-7, 7, (smooth.velocity || 0) * 0.35);
      sk += (target - sk) * 0.12;
      vel.forEach((el) => { el.style.transform = `skewY(${sk.toFixed(2)}deg) scaleY(${1 + Math.abs(sk) * 0.006})`; });
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  // --- collections chapter: pinned, five families
  const fam = document.querySelector('[data-fam]');
  if (fam) {
    const items = [...fam.querySelectorAll('[data-fam-item]')].map((li) => ({ ...li.dataset, spec: li.dataset.spec.split('|') }));
    const imgs = [...fam.querySelectorAll('.fam__disc-img')];
    const disc = fam.querySelector('[data-fam-disc]');
    const map = fam.querySelector('[data-liquid-map]');
    const field = (k) => fam.querySelector(`[data-fam-field="${k}"]`);
    const specList = fam.querySelector('[data-fam-spec]');
    const link = fam.querySelector('[data-fam-link]');
    const thumbs = [...fam.querySelectorAll('[data-fam-go]')];
    let current = -1;
    const setFam = (i, instant = false) => {
      if (i === current) return;
      current = i;
      const it = items[i];
      decodeTo(field('name'), it.name, { duration: 380 });
      decodeTo(field('bigname'), it.name, { duration: 520 });
      decodeTo(field('num'), `.${it.num}`, { duration: 300 });
      field('line').textContent = it.line;
      field('spec0').textContent = `${it.name}_DNA`;
      specList.innerHTML = it.spec.map((s) => `<li>${s}</li>`).join('');
      link.href = `/collections/${it.slug}/`;
      link.querySelector('span').textContent = `DISCOVER ${it.name}`;
      thumbs.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
      if (!instant && !prefs.reduced && map) {
        disc.classList.add('is-liquid');
        const o = { s: 0 };
        gsap.timeline({ onComplete: () => disc.classList.remove('is-liquid') })
          .to(o, { s: 70, duration: 0.3, ease: 'power2.in', onUpdate: () => map.setAttribute('scale', o.s.toFixed(1)) })
          .to(o, { s: 0, duration: 0.6, ease: 'expo.out', onUpdate: () => map.setAttribute('scale', o.s.toFixed(1)) });
      }
    };
    setFam(0, true);
    const n = items.length;
    const st = ScrollTrigger.create({
      trigger: fam, start: 'top top', end: () => `+=${window.innerHeight * n * 0.85}`, pin: true, anticipatePin: 1,
      onUpdate: (self) => setFam(Math.min(n - 1, Math.floor(self.progress * n * 0.999))),
    });
    thumbs.forEach((b, k) => b.addEventListener('click', () => {
      const y = st.start + ((k + 0.5) / n) * (st.end - st.start);
      smooth.scrollTo(y, { duration: 1.1 });
    }));
  }

  // --- runway preview: rising circles, sideways line-up
  if (!prefs.reduced) {
    document.querySelectorAll('[data-rise]').forEach((el) => {
      const k = parseInt(el.dataset.rise, 10);
      gsap.fromTo(el, { yPercent: 70 + k * 18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.circles', start: 'top bottom', end: 'center 45%', scrub: 1 } });
    });
    const lineTrack = document.querySelector('[data-lineup-track]');
    if (lineTrack && !prefs.mobile) {
      gsap.to(lineTrack, {
        x: () => -(lineTrack.scrollWidth - lineTrack.parentElement.clientWidth),
        ease: 'none',
        scrollTrigger: { trigger: '[data-lineup]', start: 'top 85%', end: 'bottom 10%', scrub: 1, invalidateOnRefresh: true },
      });
    }
  }

  // --- mascot path: one deterministic keyframe track anchored to (pin-aware) scroll positions.
  // Registered last so anchors after the pinned chapter include its pin spacing.
  if (mascot) {
    const m = prefs.mobile;
    const hero = { x: 0, y: -0.1, z: 0, ry: 0, s: m ? 0.74 : 0.88, rings: 0 };
    const anchor = (trigger, start) => ScrollTrigger.create({ trigger, start });
    const K = [
      { st: null, pose: hero },
      { st: anchor('.identity', 'top bottom'), pose: hero },
      { st: anchor('.identity', 'top top'), pose: { x: m ? 0.4 : 1.55, y: m ? 2.6 : 0.3, z: -0.6, ry: -0.65, s: m ? 0.45 : 0.6, rings: 0 }, ease: 'inOut' },
      { st: anchor('.identity', 'center top'), pose: { x: m ? 0.6 : 1.7, y: m ? 2.6 : 1.9, z: -0.6, ry: -0.95, s: m ? 0.48 : 0.56, rings: 0 } },
      { st: anchor('.identity', 'bottom top'), pose: { x: m ? 0.7 : 1.8, y: 4.2, z: -0.6, ry: -1.2, s: 0.5, rings: 0 }, hide: true },
      { st: anchor('.values', 'top bottom'), pose: { x: -3.8, y: -0.3, z: -0.4, ry: 1.0, s: m ? 0.45 : 0.56, rings: 0 }, cut: true, hide: true },
      { st: anchor('.values', 'top 35%'), pose: { x: m ? -0.4 : -1.35, y: -0.55, z: -0.4, ry: 0.35, s: m ? 0.45 : 0.56, rings: 1 }, ease: 'out' },
      { st: anchor('.values', 'center center'), pose: { x: m ? 0.4 : 1.3, y: -0.4, z: -0.4, ry: -0.4, s: m ? 0.45 : 0.56, rings: 1 } },
      { st: anchor('.values', 'bottom top'), pose: { x: 4.0, y: 0.6, z: -0.4, ry: -1.1, s: 0.6, rings: 0 }, ease: 'in', hide: true },
    ];
    const eases = { inOut: gsap.parseEase('power2.inOut'), out: gsap.parseEase('power2.out'), in: gsap.parseEase('power2.in'), none: (t) => t };
    const keys = ['x', 'y', 'z', 'ry', 's', 'rings'];
    const p = mascot.pose;
    let hidden = false;
    const place = (y) => {
      let i = 1;
      while (i < K.length && y >= K[i].st.start) i += 1;
      const a = K[i - 1];
      const b = K[i];
      let out = a.pose;
      if (b && !b.cut) {
        const y0 = a.st ? a.st.start : 0;
        const t = gsap.utils.clamp(0, 1, (y - y0) / Math.max(1, b.st.start - y0));
        const e = (eases[b.ease] || eases.none)(t);
        out = {};
        keys.forEach((k) => { out[k] = a.pose[k] + (b.pose[k] - a.pose[k]) * e; });
      }
      keys.forEach((k) => { p[k] = out[k]; });
      // stop rendering while the mascot is parked off-screen
      hidden = (a.hide && (!b || b.cut || b.hide));
      gateRender();
    };
    // extra actors share the stage: THE DROP hoodie and the footer skater (loaded after first paint)
    let drop = null;
    let skater = null;
    let dropOn = false;
    let skaterOn = false;
    function gateRender() {
      const any = !hidden || dropOn || skaterOn;
      if (any && !rt.running) rt.resume();
      else if (!any) { rt.pause(); rt.renderer.clear(); }
    }
    const dropSec = document.querySelector('[data-drop]');
    const dropBar = document.querySelector('[data-drop-bar]');
    const dropPct = document.querySelector('[data-drop-pct]');
    if (dropSec) {
      ScrollTrigger.create({
        trigger: dropSec, start: 'top top', end: () => `+=${window.innerHeight * 2.2}`, pin: true, pinSpacing: true, anticipatePin: 1, refreshPriority: 2,
        onToggle: (self) => { dropOn = self.isActive; drop?.setVisible(dropOn); dropSec.classList.toggle('is-live', dropOn && !!drop); gateRender(); },
        onUpdate: (self) => {
          drop?.setProgress(self.progress, smooth.velocity || 0);
          dropBar.style.transform = `scaleX(${self.progress})`;
          dropPct.textContent = Math.round(self.progress * 100);
        },
      });
    }
    const bottomSec = document.querySelector('.bottom');
    if (bottomSec) {
      ScrollTrigger.create({
        trigger: bottomSec, start: 'top bottom', end: 'top 15%', scrub: true,
        onToggle: (self) => { skaterOn = self.isActive || self.progress >= 1; skater?.setVisible(skaterOn); gateRender(); },
        onUpdate: (self) => skater?.setProgress(self.progress),
        onLeave: () => { skaterOn = true; skater?.setVisible(true); gateRender(); },
        onEnterBack: () => { skaterOn = true; skater?.setVisible(true); gateRender(); },
      });
    }
    loader.whenDone(9000).then(async () => {
      const { createDrop, createSkater } = await import('../scenes/extras.js');
      [drop, skater] = await Promise.all([createDrop(mascot, { mobile: prefs.mobile }).catch((e) => { console.warn(e); return null; }), createSkater(mascot, { mobile: prefs.mobile }).catch((e) => { console.warn(e); return null; })]);
      if (drop && dropOn) { drop.setVisible(true); dropSec.classList.add('is-live'); }
      if (skater && skaterOn) skater.setVisible(true);
      ScrollTrigger.refresh();
    });
    smooth.onScroll((y) => place(y));
    ScrollTrigger.addEventListener('refresh', () => place(smooth.y));
    place(smooth.y);
    window.__bandripDebug = () => ({ y: smooth.y, starts: K.map((k) => (k.st ? Math.round(k.st.start) : 0)), pose: { x: p.x, y: p.y, s: p.s }, hidden });
  }

  ScrollTrigger.sort();

  // --- footer: scan-line word + typed readouts
  const scan = document.querySelector('[data-scan]');
  if (scan) cleanups.push(scanWord(scan, 'BANDRIP'));
  const typed = [...document.querySelectorAll('[data-type]')];
  if (typed.length) {
    typed.forEach((el) => { el.dataset.full = el.textContent; if (!prefs.reduced) el.textContent = ''; });
    ScrollTrigger.create({
      trigger: '.bottom', start: 'top 70%', once: true,
      onEnter: () => typed.forEach((el, i) => {
        if (prefs.reduced) return;
        const full = el.dataset.full;
        const o = { n: 0 };
        gsap.to(o, { n: full.length, duration: 0.03 * full.length, delay: i * 0.18, ease: 'none', onUpdate: () => { el.textContent = full.slice(0, Math.round(o.n)); } });
      }),
    });
  }
  document.querySelector('[data-to-top]')?.addEventListener('click', (e) => { e.preventDefault(); smooth.scrollTo(0, { duration: 2 }); });

  return {
    stats,
    ready: loader.whenDone(8000),
    enter() {
      const hero = document.querySelector('.hero');
      hero.querySelectorAll('.hero__micro [data-decode]').forEach((el, i) => decode(el, { delay: 300 + i * 120 }));
      if (prefs.reduced) { if (mascot) mascot.pose.enter = 1; return; }
      const tl = gsap.timeline();
      tl.from('.hero__marquee', { yPercent: -40, autoAlpha: 0, duration: 1.1, ease: 'expo.out' }, 0.05)
        .from('.hero__corner', { yPercent: 60, autoAlpha: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.25)
        .from('.hero__actions > *', { y: 20, autoAlpha: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }, 0.45);
      if (mascot) tl.fromTo(mascot.pose, { enter: 0 }, { enter: 1, duration: 1.8, ease: 'expo.out' }, 0.1);
      else gsap.from('.hero__poster', { yPercent: 12, autoAlpha: 0, duration: 1.4, ease: 'expo.out' });
    },
    beforeLeave() { return Promise.resolve(); },
    destroy() { cleanups.forEach((fn) => fn()); rt?.dispose(mascot?.scene); },
  };
}
