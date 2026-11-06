// Footer word drawn from horizontal scan-lines that bend toward the pointer (DICH footer).
import { prefs } from '../core/prefs.js';

export function scanWord(canvas, word = 'BANDRIP') {
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  let W = 0;
  let H = 0;
  let dpr = 1;
  let data = null;
  let px = -9999;
  let py = -9999;
  let tx = -9999;
  let ty = -9999;
  let raf = 0;
  let visible = false;
  let t = 0;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    mask.width = W;
    mask.height = H;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#fff';
    let size = H * 0.9;
    mctx.font = `${size}px Anton, Impact, sans-serif`;
    const mw = mctx.measureText(word).width;
    if (mw > W * 0.92) { size *= (W * 0.92) / mw; mctx.font = `${size}px Anton, Impact, sans-serif`; }
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillText(word, W / 2, H / 2 + size * 0.04);
    data = mctx.getImageData(0, 0, W, H).data;
  }

  const inside = (x, y) => {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
    return data[(yi * W + xi) * 4 + 3] > 128;
  };

  function draw() {
    raf = 0;
    if (!visible) return;
    t += 0.016;
    px += (tx - px) * 0.12;
    py += (ty - py) * 0.12;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const gap = Math.max(5, H / 64);
    for (let y = gap / 2; y < H; y += gap) {
      let inWord = false;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        const pull = Math.exp(-d2 / (2 * 70 * 70)) * 22;
        const wave = prefs.reduced ? 0 : Math.sin(x * 0.012 + t * 1.4 + y * 0.05) * 0.8;
        const yy = y + wave - Math.sign(dy || 1) * pull;
        const now = inside(x, y);
        if (now !== inWord) {
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = now ? 'rgba(233, 201, 168, 0.95)' : 'rgba(242, 240, 233, 0.12)';
          ctx.lineWidth = now ? 1.2 : 1;
          inWord = now;
        }
        if (x === 0 || now !== inWord) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    if (!prefs.reduced) raf = requestAnimationFrame(draw);
  }

  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(draw); };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    kick();
  });
  canvas.addEventListener('pointerleave', () => { tx = -9999; ty = -9999; });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { layout(); kick(); });
  ro.observe(canvas);
  document.fonts?.ready.then(() => { layout(); kick(); });
  return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
}
