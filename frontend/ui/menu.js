// Numbered index overlay (DICH menu): dim, overlay, decoding list, flanking figures.
import { gsap } from 'gsap';
import { prefs } from '../core/prefs.js';
import { smooth } from '../core/smooth.js';
import { decode } from './decode.js';

const html = document.documentElement;

export function initMenu() {
  const menu = document.getElementById('menu');
  const btn = document.querySelector('.frame__menu');
  if (!menu || !btn) return;
  const links = [...menu.querySelectorAll('a')];
  const labels = [...menu.querySelectorAll('.menu__label')];
  const figs = [...menu.querySelectorAll('.menu__figure')];
  let open = false;
  let lastFocus = null;

  function show() {
    open = true;
    lastFocus = document.activeElement;
    menu.hidden = false;
    html.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
    smooth.stop();
    if (!prefs.reduced) {
      gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.5, ease: 'expo.out' });
      gsap.fromTo(figs, { yPercent: 18, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 0.9, duration: 0.8, ease: 'expo.out', delay: 0.15, stagger: 0.08 });
      gsap.fromTo(menu.querySelectorAll('li'), { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.06, delay: 0.12 });
      labels.forEach((l, i) => decode(l, { delay: 150 + i * 60, duration: 420 }));
    }
    links[0]?.focus({ preventScroll: true });
  }

  function hide() {
    open = false;
    html.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    const done = () => { menu.hidden = true; smooth.start(); lastFocus?.focus?.({ preventScroll: true }); };
    if (prefs.reduced) { done(); return; }
    gsap.to(menu, { clipPath: 'inset(100% 0 0 0)', duration: 0.35, ease: 'power3.in', onComplete: done });
  }

  btn.addEventListener('click', () => (open ? hide() : show()));
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key !== 'Tab') return;
    const f = [...links, ...menu.querySelectorAll('.menu__credits a')];
    const all = [btn, ...f];
    const i = all.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
    else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0].focus(); }
  });
  btn.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') hide(); });
  links.forEach((a) => a.addEventListener('click', () => { if (a.getAttribute('aria-current')) hide(); }));
  return { hide, get open() { return open; } };
}
