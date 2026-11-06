// DICH-style decode: random glyphs resolve left -> right.
import { prefs } from '../core/prefs.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_<>+#';
const rand = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
const running = new WeakMap();

function scrambled(text, keep = 0) {
  let out = '';
  for (let i = 0; i < text.length; i++) out += i < keep || text[i] === ' ' || text[i] === '\n' ? text[i] : rand();
  return out;
}

/** Decode one element's text. Resolves when finished. */
export function decode(el, { duration, delay = 0, perChar = 32 } = {}) {
  const final = el.dataset.final ?? (el.dataset.final = el.textContent);
  if (prefs.reduced || !final.trim()) { el.textContent = final; return Promise.resolve(); }
  const total = duration ?? Math.min(900, Math.max(380, final.length * perChar));
  cancelAnimationFrame(running.get(el));
  return new Promise((resolve) => {
    const t0 = performance.now() + delay;
    let lastSwap = 0;
    const tick = (now) => {
      const t = now - t0;
      if (t < 0) { running.set(el, requestAnimationFrame(tick)); return; }
      const keep = Math.floor((t / total) * final.length);
      if (keep >= final.length) { el.textContent = final; resolve(); return; }
      if (now - lastSwap > 45) { el.textContent = scrambled(final, keep); lastSwap = now; }
      running.set(el, requestAnimationFrame(tick));
    };
    running.set(el, requestAnimationFrame(tick));
  });
}

/** Swap an element to new text with a decode. */
export function decodeTo(el, text, opts) {
  el.dataset.final = text;
  return decode(el, opts);
}

/** Pre-scramble [data-decode] elements and decode each once when it scrolls into view. */
export function initDecode(root = document) {
  const els = [...root.querySelectorAll('[data-decode]:not([data-decode-ready])')];
  const blocks = [...root.querySelectorAll('[data-decode-block]')];
  blocks.forEach((b) => b.querySelectorAll(':scope > span').forEach((s) => { s.setAttribute('data-decode', ''); els.push(s); }));
  if (prefs.reduced) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const sib = [...e.target.parentElement.querySelectorAll(':scope > [data-decode]')];
      decode(e.target, { delay: Math.max(0, sib.indexOf(e.target)) * 110 });
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach((el) => {
    if (el.closest('.menu')) return;   // menu decodes on open
    el.setAttribute('data-decode-ready', '');
    el.dataset.final = el.textContent;
    el.textContent = scrambled(el.textContent);
    io.observe(el);
  });
}

/** Continuous decode loop for decorative readouts (gate, footer). */
export function decodeLoop(els, every = 2600) {
  if (prefs.reduced || !els.length) return () => {};
  let i = 0;
  const id = setInterval(() => { decode(els[i % els.length], { duration: 520 }); i += 1; }, every / els.length);
  els.forEach((el, k) => decode(el, { delay: k * 140 }));
  return () => clearInterval(id);
}
