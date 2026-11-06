// Scroll-sprayed tag: a sprayed artwork is revealed along a zig-zag nozzle path as you scroll.
// Particles are seeded, so scrolling back up "un-sprays" deterministically. The can follows the nozzle.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export function sprayReveal(el, { trigger = el, start = 'top 75%', end = 'bottom 25%', reduced = false } = {}) {
  const src = el.dataset.src;
  const canSrc = el.dataset.can;
  const canvas = document.createElement('canvas');
  const can = document.createElement('img');
  can.src = canSrc;
  can.alt = '';
  can.className = 'spraytag__can';
  el.append(canvas, can);
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');
  const img = new Image();
  let ready = false;
  let path = [];
  let dots = [];
  let W = 0;
  let H = 0;
  let last = -1;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = el.clientWidth;
    H = Math.round(W * (img.height / img.width));
    el.style.height = `${H}px`;
    for (const c of [canvas, mask]) { c.width = W * dpr; c.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // zig-zag sweeps across the tag, like a writer filling letters
    const rows = 3;
    const r = H / rows * 0.62;
    path = [];
    for (let row = 0; row < rows; row++) {
      const y = H * (row + 0.5) / rows;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = (row % 2 ? 1 - t : t) * (W + r) - r / 2;
        path.push({ x, y: y + Math.sin(t * 9 + row) * r * 0.25 });
      }
    }
    const rand = rng(17);
    dots = path.map(() => Array.from({ length: 26 }, () => {
      const a = rand() * Math.PI * 2;
      const d = (rand() + rand()) * 0.5 * r * 1.15;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 0.8 + rand() * 2.4, a: 0.25 + rand() * 0.6 };
    }));
    el.style.setProperty('--r', `${r}px`);
    last = -1;
  }

  function draw(p) {
    if (!ready) return;
    const n = Math.floor(p * (path.length - 1));
    if (n === last) return;
    last = n;
    mctx.clearRect(0, 0, W, H);
    const r = H / 3 * 0.62;
    for (let i = 0; i <= n; i++) {
      const pt = path[i];
      const g = mctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g;
      mctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
      mctx.fillStyle = '#000';
      for (const d of dots[i]) { mctx.globalAlpha = d.a; mctx.fillRect(pt.x + d.dx, pt.y + d.dy, d.s, d.s); }
      mctx.globalAlpha = 1;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, 0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const head = path[Math.max(0, n)];
    const on = p > 0.01 && p < 0.99;
    can.style.opacity = on ? '1' : '0';
    can.style.transform = `translate(${head.x}px, ${head.y}px) rotate(-28deg)`;
  }

  img.onload = () => {
    ready = true;
    build();
    if (reduced) { draw(1); return; }
    const st = ScrollTrigger.create({ trigger, start, end, scrub: true, onUpdate: (self) => draw(self.progress) });
    draw(st.progress);
    new ResizeObserver(() => { build(); draw(st.progress); }).observe(el);
  };
  img.src = src;
}
