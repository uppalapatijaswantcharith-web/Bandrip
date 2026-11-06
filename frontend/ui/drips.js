// BANDRIP page transition: wet paint runs down to cover the screen, then drains away to reveal.
// Same API as the old mosaic (cover / coverNow / reveal / hide) so every caller stays the same.
import { gsap } from 'gsap';
import { prefs } from '../core/prefs.js';

const host = document.querySelector('.mosaic');
let canvas = null;
let ctx = null;
let cols = [];
let W = 0;
let H = 0;
let dpr = 1;
let active = false;

const PAINT = ['#151515', '#151515', '#151515', '#1B1A19', '#E63228'];

function build() {
  if (!host) return;
  host.innerHTML = '';
  canvas = document.createElement('canvas');
  canvas.className = 'drips__canvas';
  host.appendChild(canvas);
  ctx = canvas.getContext('2d');
  layout();
  window.addEventListener('resize', layout);
  document.documentElement.classList.add('mosaic-built');
}

function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const n = prefs.mobile ? 9 : 16;
  cols = [];
  let x = -10;
  for (let i = 0; i < n; i++) {
    const w = (W / n) * (1.15 + ((i * 37) % 7) / 10);
    cols.push({
      x, w,
      color: PAINT[(i * 3) % PAINT.length] === '#E63228' && i % 5 === 2 ? '#E63228' : '#151515',
      top: 0, bottom: 0, delay: ((i * 53) % 11) / 11,
      tips: [0.25, 0.55, 0.8].map((f, k) => ({ f, len: 30 + ((i * 17 + k * 29) % 70), r: 5 + ((i + k) % 4) * 2 })),
    });
    x += W / n;
  }
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (const c of cols) {
    if (c.bottom <= c.top) continue;
    ctx.fillStyle = c.color;
    const r = c.w / 2;
    ctx.beginPath();
    // body with a rounded leading edge at the bottom and rounded tail at the top
    ctx.moveTo(c.x, c.top + (c.top > 0 ? r * 0.6 : 0));
    if (c.top > 0) ctx.quadraticCurveTo(c.x + c.w / 2, c.top - r * 0.4, c.x + c.w, c.top + r * 0.6);
    else ctx.lineTo(c.x + c.w, 0);
    ctx.lineTo(c.x + c.w, c.bottom - r * 0.5);
    ctx.quadraticCurveTo(c.x + c.w / 2, c.bottom + r * 0.7, c.x, c.bottom - r * 0.5);
    ctx.closePath();
    ctx.fill();
    // thin drips ahead of the column, ending in bulbs
    for (const tip of c.tips) {
      const tx = c.x + c.w * tip.f;
      const ty = c.bottom + tip.len * Math.min(1, c.bottom / (H * 0.3));
      if (ty <= c.top || c.bottom <= 0) continue;
      ctx.fillRect(tx - tip.r * 0.45, c.bottom - 6, tip.r * 0.9, ty - c.bottom + 6);
      ctx.beginPath();
      ctx.arc(tx, ty, tip.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    // wet-paint gloss
    const g = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.07)');
    g.addColorStop(0.3, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x, Math.max(0, c.top), c.w, Math.max(0, c.bottom - c.top));
  }
}

const tick = () => { if (active) draw(); };

function start() {
  if (!canvas) build();
  host.classList.add('is-active');
  if (!active) { active = true; gsap.ticker.add(tick); }
}
function stop() {
  active = false;
  gsap.ticker.remove(tick);
  host.classList.remove('is-active');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
}

export const mosaic = {
  coverNow() {
    start();
    cols.forEach((c) => { c.top = 0; c.bottom = H + 120; });
    draw();
  },
  cover() {
    if (!host) return Promise.resolve();
    start();
    if (prefs.reduced) { mosaic.coverNow(); return Promise.resolve(); }
    cols.forEach((c) => { c.top = 0; c.bottom = 0; });
    return new Promise((res) => {
      const tl = gsap.timeline({ onComplete: res });
      cols.forEach((c) => tl.to(c, { bottom: H + 140, duration: 0.55 + c.delay * 0.25, ease: 'power2.in' }, c.delay * 0.22));
    });
  },
  reveal() {
    if (!host) return Promise.resolve();
    if (!active) mosaic.coverNow();
    document.documentElement.classList.remove('arriving');
    if (prefs.reduced) {
      return new Promise((res) => gsap.to(host, { autoAlpha: 0, duration: 0.25, onComplete: () => { gsap.set(host, { clearProps: 'all' }); stop(); res(); } }));
    }
    return new Promise((res) => {
      const tl = gsap.timeline({ onComplete: () => { stop(); res(); } });
      cols.forEach((c) => {
        tl.to(c, { top: H + 200, duration: 0.85 + c.delay * 0.3, ease: 'power2.in' }, c.delay * 0.28);
        tl.to(c, { bottom: H + 400, duration: 0.85 + c.delay * 0.3, ease: 'power1.in' }, c.delay * 0.28);
      });
    });
  },
  hide() { stop(); },
};

window.addEventListener('pageshow', (e) => {
  if (e.persisted) { mosaic.hide(); document.documentElement.classList.remove('arriving'); }
});
