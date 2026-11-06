// Block-mosaic shutter (measured from DICH's gate -> hero transition):
// columns of ink blocks with varied heights retract vertically, centre-out,
// leaving hairline outlines that fade last.
import { gsap } from 'gsap';
import { prefs } from '../core/prefs.js';

const root = document.querySelector('.mosaic');
let blocks = [];
let built = false;

function build() {
  if (!root) return;
  root.innerHTML = '';
  const cols = prefs.mobile ? 4 : 8;
  root.style.setProperty('--cols', cols);
  blocks = [];
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'mosaic__col';
    const n = 3 + ((c * 7 + 3) % 3);
    for (let r = 0; r < n; r++) {
      const b = document.createElement('div');
      b.className = 'mosaic__block';
      b.style.setProperty('--h', (0.6 + ((c * 13 + r * 7) % 10) / 4).toFixed(2));
      b.style.transformOrigin = (c + r) % 2 ? '50% 0%' : '50% 100%';
      const dist = Math.abs(c - (cols - 1) / 2);
      b.dataset.order = String(dist + r * 0.18 + ((c * 31 + r * 17) % 7) * 0.04);
      col.appendChild(b);
      blocks.push(b);
    }
    root.appendChild(col);
  }
  built = true;
  document.documentElement.classList.add('mosaic-built');
}

const byOrder = (dir = 1) => [...blocks].sort((a, b) => dir * (a.dataset.order - b.dataset.order));

export const mosaic = {
  /** Instantly cover the screen (used on arrival before reveal). */
  coverNow() {
    if (!built) build();
    root.classList.add('is-active');
    gsap.set(blocks, { scaleY: 1, '--outline': 0 });
  },
  /** Animate blocks in to cover the screen. */
  cover() {
    if (!root) return Promise.resolve();
    if (!built) build();
    root.classList.add('is-active');
    if (prefs.reduced) { gsap.set(blocks, { scaleY: 1 }); return Promise.resolve(); }
    gsap.set(blocks, { scaleY: 0, '--outline': 0 });
    return new Promise((res) => {
      const order = byOrder(-1);
      gsap.to(order, { scaleY: 1, duration: 0.42, ease: 'power3.in', stagger: { each: 0.014 }, onComplete: res });
    });
  },
  /** Retract blocks, centre-out, with lingering outlines. */
  reveal() {
    if (!root) return Promise.resolve();
    if (!built) mosaic.coverNow();
    root.classList.add('is-active');
    document.documentElement.classList.remove('arriving');
    const done = () => { root.classList.remove('is-active'); gsap.set(blocks, { clearProps: 'transform' }); };
    if (prefs.reduced) {
      return new Promise((res) => gsap.to(root, { autoAlpha: 0, duration: 0.25, onComplete: () => { gsap.set(root, { clearProps: 'all' }); done(); res(); } }));
    }
    return new Promise((res) => {
      const order = byOrder(1);
      const tl = gsap.timeline({ onComplete: () => { done(); res(); } });
      tl.to(order, { '--outline': 1, duration: 0.12, stagger: 0.004 }, 0)
        .to(order, { scaleY: 0, duration: 0.62, ease: 'expo.inOut', stagger: { each: 0.022 } }, 0.08)
        .to(order, { '--outline': 0, duration: 0.25, stagger: 0.006 }, '-=0.25');
    });
  },
  hide() {
    root?.classList.remove('is-active');
    gsap.set(blocks, { scaleY: 0, '--outline': 0 });
  },
};

window.addEventListener('pageshow', (e) => {
  // back/forward cache: never leave the page covered
  if (e.persisted) { mosaic.hide(); document.documentElement.classList.remove('arriving'); }
});
