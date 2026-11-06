// Chapter colour fields + frame label: crossfade as each chapter crosses mid-viewport.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setFrameLabel } from './frame.js';

function isDark(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 120;
}

export function applyField(field, label) {
  const body = document.body;
  if (field) {
    body.style.backgroundColor = field;
    document.documentElement.style.setProperty('--field', field);
    body.classList.toggle('on-dark', isDark(field));
  }
  if (label) setFrameLabel(label);
}

export function initChapters(root = document) {
  const chapters = [...root.querySelectorAll('[data-field], [data-label]')];
  // each chapter owns its colour field (so paint can drip from one into the next)
  chapters.forEach((sec) => {
    const f = sec.dataset.field;
    if (!f || sec.classList.contains('hero')) return;
    sec.style.backgroundColor = f;
    sec.classList.toggle('is-dark', isDark(f));
  });
  const triggers = chapters.map((sec) => ScrollTrigger.create({
    trigger: sec,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => { if (self.isActive) applyField(sec.dataset.field, sec.dataset.label); },
  }));
  const first = chapters[0];
  if (first) applyField(first.dataset.field, first.dataset.label);
  return () => triggers.forEach((t) => t.kill());
}
