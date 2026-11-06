// Weighted progress over real asset loads; feeds the gate percentage.
const tasks = [];
const subs = new Set();
let settled = false;

function emit() {
  const total = tasks.reduce((s, t) => s + t.weight, 0) || 1;
  const done = tasks.reduce((s, t) => s + t.weight * t.progress, 0);
  const pct = Math.min(1, done / total);
  subs.forEach((fn) => fn(pct));
}

export const loader = {
  /** Register a task; returns a progress setter (0..1). */
  add(weight = 1) {
    const t = { weight, progress: 0 };
    tasks.push(t);
    emit();
    return (p) => { t.progress = Math.max(t.progress, Math.min(1, p)); emit(); };
  },
  /** Track a promise as a single task. */
  track(promise, weight = 1) {
    const set = loader.add(weight);
    return Promise.resolve(promise).finally(() => set(1));
  },
  /** Track an <img> element. */
  image(img, weight = 1) {
    if (!img) return Promise.resolve();
    const set = loader.add(weight);
    if (img.complete && img.naturalWidth) { set(1); return Promise.resolve(); }
    return new Promise((res) => {
      const done = () => { set(1); res(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  },
  onProgress(fn) { subs.add(fn); emit(); return () => subs.delete(fn); },
  get done() { return tasks.every((t) => t.progress >= 1); },
  whenDone(maxMs = 8000) {
    if (settled || loader.done) return Promise.resolve();
    return new Promise((res) => {
      const timer = setTimeout(() => { settled = true; res(); }, maxMs);
      const off = loader.onProgress((p) => { if (p >= 1) { clearTimeout(timer); off(); res(); } });
    });
  },
};
