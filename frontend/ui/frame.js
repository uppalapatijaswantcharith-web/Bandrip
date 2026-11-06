// HUD frame: bezel path with notched tabs, live coordinates, section label.
import { prefs } from '../core/prefs.js';
import { smooth } from '../core/smooth.js';
import { decodeTo } from './decode.js';

const path = document.querySelector('.frame__path');
const coords = document.querySelector('[data-frame-coords]');
const label = document.querySelector('[data-frame-label]');
const tabs = [...document.querySelectorAll('.frame__tab')];

function px(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function drawFrame() {
  if (!path) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const B = Math.max(8, Math.min(18, W * 0.013));
  const c = Math.max(8, Math.min(14, W * 0.01));
  const th = Math.max(18, Math.min(26, W * 0.019));
  const tw = Math.min(W * 0.36, Math.max(170, (label?.offsetWidth || 120) + 120));
  const bw = Math.min(W * 0.36, 230);
  const s = th * 1.1;
  const cx = W / 2;
  const tick = prefs.mobile ? 0 : 6;
  // phones: a solid top band (brand, label, menu live inside it) so content never runs under the HUD text
  const phone = window.matchMedia('(max-width: 760px)').matches;
  const T = phone ? B + 46 : B;
  const top = phone
    ? [[B + c, T]]
    : [[B + c, B], [cx - tw / 2 - s, B], [cx - tw / 2, B + th], [cx + tw / 2, B + th], [cx + tw / 2 + s, B]];
  const pts = [
    ...top,
    [W - B - c, T], [W - B, T + c],
    [W - B, H / 2 - 70], [W - B - tick, H / 2 - 56], [W - B - tick, H / 2 + 56], [W - B, H / 2 + 70],
    [W - B, H - B - c], [W - B - c, H - B],
    [cx + bw / 2 + s, H - B], [cx + bw / 2, H - B - th], [cx - bw / 2, H - B - th], [cx - bw / 2 - s, H - B],
    [B + c, H - B], [B, H - B - c],
    [B, H / 2 + 70], [B + tick, H / 2 + 56], [B + tick, H / 2 - 56], [B, H / 2 - 70],
    [B, T + c],
  ];
  const inner = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L') + ' Z';
  path.setAttribute('d', `M0 0 H${W} V${H} H0 Z ${inner}`);
  path.parentElement.setAttribute('viewBox', `0 0 ${W} ${H}`);
  tabs.forEach((t) => { t.style.width = `${(t.classList.contains('frame__tab--top') ? tw : bw)}px`; });
}

let mx = 0.5;
let my = 0.5;
let queued = false;
function writeCoords() {
  queued = false;
  if (!coords) return;
  coords.textContent = `X.${String(Math.round(mx * 10000)).padStart(4, '0')} // Y.${String(Math.round(my * 10000)).padStart(4, '0')}`;
}

export function setFrameLabel(text) {
  if (!label || label.dataset.final === text) return;
  decodeTo(label, text, { duration: 420 });
  requestAnimationFrame(drawFrame);
}

export function initFrame() {
  drawFrame();
  window.addEventListener('resize', drawFrame);
  if (!prefs.touch) {
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX / window.innerWidth;
      my = e.clientY / window.innerHeight;
      if (!queued) { queued = true; requestAnimationFrame(writeCoords); }
    }, { passive: true });
  } else {
    smooth.onScroll((y) => {
      const max = document.documentElement.scrollHeight - window.innerHeight || 1;
      mx = 0.5;
      my = y / max;
      if (!queued) { queued = true; requestAnimationFrame(writeCoords); }
    });
  }
  writeCoords();
}
