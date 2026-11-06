// BANDRIP opening: spray the stencil tag on the wall to enter.
// Real asset % feeds the paint gauge; holding sprays particles through a BANDRIP stencil
// (dense inside the letters, faint overspray outside). Coverage completes the tag, drips run,
// and the wet-paint transition opens the site. Enter/Space or a click auto-sprays; Skip always works.
import { gsap } from 'gsap';
import { loader } from '../core/loader.js';
import { prefs } from '../core/prefs.js';
import { mosaic } from './drips.js';

const html = document.documentElement;

export function runGate() {
  const gate = document.querySelector('[data-gate]');
  if (!gate || !html.classList.contains('gate-on')) return Promise.resolve(false);
  const canvas = gate.querySelector('[data-gate-paint]');
  const pctEl = gate.querySelector('[data-gate-pct]');
  const bar = gate.querySelector('[data-gate-bar]');
  const btn = gate.querySelector('[data-gate-ring]');
  const label = gate.querySelector('[data-gate-label]');
  const can = gate.querySelector('[data-gate-can]');
  const skip = gate.querySelector('[data-gate-skip]');
  const ctx = canvas.getContext('2d');
  btn.focus({ preventScroll: true });

  let W = 0; let H = 0; let dpr = 1;
  const stencil = document.createElement('canvas');
  const sctx = stencil.getContext('2d');
  const paint = document.createElement('canvas');
  const pctx = paint.getContext('2d');
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  const probe = document.createElement('canvas');
  const prb = probe.getContext('2d', { willReadFrequently: true });
  let box = { x: 0, y: 0, w: 1, h: 1 };
  let samples = [];

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    for (const c of [canvas, stencil, paint, tmp]) { c.width = W * dpr; c.height = H * dpr; }
    for (const c of [ctx, sctx, pctx, tctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    let size = Math.min(W * 0.2, H * 0.3);
    sctx.font = `${size}px "Saira Stencil One", Impact, sans-serif`;
    const tw = sctx.measureText('BANDRIP').width;
    if (tw > W * 0.86) { size *= (W * 0.86) / tw; sctx.font = `${size}px "Saira Stencil One", Impact, sans-serif`; }
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillStyle = '#fff';
    sctx.fillText('BANDRIP', W / 2, H * 0.47);
    const w = sctx.measureText('BANDRIP').width;
    box = { x: W / 2 - w / 2, y: H * 0.47 - size * 0.42, w, h: size * 0.84 };
    probe.width = 160;
    probe.height = Math.round(160 * H / W);
    prb.clearRect(0, 0, probe.width, probe.height);
    prb.drawImage(stencil, 0, 0, probe.width, probe.height);
    const d = prb.getImageData(0, 0, probe.width, probe.height).data;
    samples = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) samples.push(i);
  }
  layout();
  window.addEventListener('resize', layout);
  document.fonts?.load('400 120px "Saira Stencil One"').then(layout);

  // paint gauge = real asset loading
  let shown = 0;
  const offProgress = loader.onProgress((p) => {
    gsap.to({ v: shown }, { v: p * 100, duration: 0.5, ease: 'power2.out', onUpdate() { shown = this.targets()[0].v; pctEl.textContent = Math.round(shown); bar.style.transform = `scaleX(${shown / 100})`; } });
  });

  // nozzle: follows the pointer, or sweeps the stencil automatically
  const noz = { x: W * 0.3, y: H * 0.47 };
  let spraying = false;
  let auto = false;
  let sweep = 0;
  let coverage = 0;
  let pointerSeen = false;
  let finished = false;
  let frameN = 0;
  let finish = () => {};

  function sprayAt(x, y, dt) {
    const n = Math.round(65 * dt * 60);
    pctx.fillStyle = '#E63228';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.abs(Math.random() + Math.random() - 1) * 46;
      pctx.globalAlpha = 0.18 + Math.random() * 0.35;
      pctx.beginPath();
      pctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.6 + Math.random() * 2.2, 0, Math.PI * 2);
      pctx.fill();
    }
    const g = pctx.createRadialGradient(x, y, 0, x, y, 30);
    g.addColorStop(0, 'rgba(230,50,40,0.22)');
    g.addColorStop(1, 'rgba(230,50,40,0)');
    pctx.globalAlpha = 1;
    pctx.fillStyle = g;
    pctx.fillRect(x - 30, y - 30, 60, 60);
  }

  function composite() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 0.08;                       // stencil guide
    ctx.drawImage(stencil, 0, 0, W, H);
    ctx.globalAlpha = 0.16;                       // overspray outside the stencil
    ctx.drawImage(paint, 0, 0, W, H);
    tctx.clearRect(0, 0, W, H);                   // paint that went through the stencil
    tctx.globalCompositeOperation = 'source-over';
    tctx.drawImage(paint, 0, 0, W, H);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(stencil, 0, 0, W, H);
    tctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(tmp, 0, 0, W, H);
  }
  composite();

  function measure() {
    prb.clearRect(0, 0, probe.width, probe.height);
    prb.drawImage(paint, 0, 0, probe.width, probe.height);
    const d = prb.getImageData(0, 0, probe.width, probe.height).data;
    let hit = 0;
    for (const i of samples) if (d[i + 3] > 90) hit += 1;
    coverage = samples.length ? hit / samples.length : 1;
  }

  let last = performance.now();
  let raf = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (finished) return;
    if (auto || (spraying && !pointerSeen)) {
      sweep += dt / (prefs.reduced ? 0.6 : 2.4);   // zig-zag across the stencil, 6 passes
      const pass = Math.min(5.999, sweep * 6);
      const row = Math.floor(pass);
      const t = pass - row;
      noz.x = box.x - 20 + (row % 2 ? 1 - t : t) * (box.w + 40);
      noz.y = box.y + ((row + 0.5) / 6) * box.h;
    }
    const active = spraying || auto;
    can.classList.toggle('is-shaking', active);
    can.style.transform = `translate(${noz.x + 26}px, ${noz.y - 30}px) rotate(${active ? -26 : -12}deg)`;
    if (active) {
      sprayAt(noz.x, noz.y, dt);
      composite();
      frameN += 1;
      if (frameN % 8 === 0) measure();
      label.textContent = `TAGGING ${Math.min(100, Math.round((coverage * 100) / 0.7))}%`;
      if (coverage >= 0.7 || sweep >= 1) finish();
    }
  };
  raf = requestAnimationFrame(loop);

  return new Promise((resolve) => {
    finish = async () => {
      if (finished) return;
      finished = true;
      can.classList.remove('is-shaking');
      pctx.globalAlpha = 1;                        // fill the rest of the letters
      pctx.fillStyle = '#E63228';
      pctx.fillRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20);
      composite();
      label.textContent = 'TAGGED';
      if (!prefs.reduced) {
        const drips = Array.from({ length: 14 }, () => ({ x: box.x + Math.random() * box.w, y: box.y + box.h * (0.72 + Math.random() * 0.2), len: 0, max: 30 + Math.random() * 120, w: 3 + Math.random() * 5 }));
        await new Promise((res) => gsap.to(drips, {
          len: (i, d) => d.max, duration: 0.7, ease: 'power2.in', stagger: 0.02,
          onUpdate: () => {
            ctx.fillStyle = '#E63228';
            drips.forEach((d) => { ctx.fillRect(d.x - d.w / 2, d.y, d.w, d.len); ctx.beginPath(); ctx.arc(d.x, d.y + d.len, d.w * 0.8, 0, Math.PI * 2); ctx.fill(); });
          },
          onComplete: res,
        }));
      }
      if (!loader.done) { label.textContent = 'LOADING PAINT'; await loader.whenDone(6000); }
      offProgress();
      try { sessionStorage.setItem('bandrip-entered', '1'); } catch { /* gate shows next time */ }
      await mosaic.cover();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      html.classList.remove('gate-on');
      gate.remove();
      resolve(true);
    };

    const move = (e) => { noz.x = e.clientX; noz.y = e.clientY; pointerSeen = true; };
    gate.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e); });
    gate.addEventListener('pointerdown', (e) => {
      if (e.target === skip) return;
      if (e.pointerType === 'touch') pointerSeen = false;   // touch: hold anywhere, the can sweeps
      else move(e);
      spraying = true;
    });
    let idle = 0;
    const up = () => {
      if (!spraying) return;
      spraying = false;
      clearTimeout(idle);
      // started but let go: the can finishes the tag for you
      idle = setTimeout(() => { if (!spraying && !finished) { sweep = Math.max(sweep, coverage * 0.6); auto = true; } }, 1100);
    };
    window.addEventListener('pointerup', up);
    gate.addEventListener('pointercancel', up);
    btn.addEventListener('click', (e) => { if (e.detail === 0) auto = true; });
    gate.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); auto = true; }
      if (e.key === 'Escape') { auto = true; finish(); }
    });
    skip.addEventListener('click', (e) => { e.stopPropagation(); auto = true; finish(); });
    setTimeout(() => { if (!finished && !spraying) auto = true; }, 12000);   // never trap anyone
  });
}
