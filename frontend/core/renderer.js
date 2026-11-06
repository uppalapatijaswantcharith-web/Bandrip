// One WebGL renderer per page: DPR caps, resize, visibility pausing, disposal.
import * as THREE from 'three';
import { prefs } from './prefs.js';

export function createRenderer(canvas, { alpha = true, antialias = true, maxDpr } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: antialias && !prefs.mobile, powerPreference: 'high-performance' });
  const cap = maxDpr ?? (prefs.mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  let frameFn = null;
  let running = false;
  let visible = true;
  let inView = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const resizeSubs = new Set();
  const stats = { frames: 0, start: 0 };

  function size() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    resizeSubs.forEach((fn) => fn(w, h));
  }
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  size();

  function loop() {
    raf = 0;
    if (!running || !visible || !inView) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    frameFn?.(dt, clock.elapsedTime);
    stats.frames += 1;
    raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (!raf && running && visible && inView) { clock.getDelta(); raf = requestAnimationFrame(loop); }
  }
  const onVis = () => { visible = document.visibilityState === 'visible'; kick(); };
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); });
  io.observe(canvas);

  return {
    renderer,
    get size() { return { w: canvas.clientWidth, h: canvas.clientHeight }; },
    onResize(fn) { resizeSubs.add(fn); fn(canvas.clientWidth, canvas.clientHeight); return () => resizeSubs.delete(fn); },
    start(fn) { frameFn = fn; running = true; stats.start = performance.now(); kick(); },
    pause() { running = false; },
    resume() { running = true; kick(); },
    get running() { return running && visible && inView; },
    stats,
    dispose(scene) {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene?.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
          m.dispose();
        });
      });
      renderer.dispose();
    },
  };
}
