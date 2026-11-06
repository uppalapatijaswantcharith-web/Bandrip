// Lenis smooth scroll wired into GSAP's ticker and ScrollTrigger.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefs } from './prefs.js';

let lenis = null;
const listeners = new Set();
let lastY = window.scrollY;
let velocity = 0;

export const smooth = {
  get velocity() { return lenis ? lenis.velocity : velocity; },
  get y() { return lenis ? lenis.scroll : window.scrollY; },
  scrollTo(target, opts = {}) {
    if (lenis) lenis.scrollTo(target, { duration: 1.4, ...opts });
    else if (typeof target === 'number') window.scrollTo(0, target);
    else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView();
  },
  stop() { lenis?.stop(); },
  start() { lenis?.start(); },
  onScroll(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function initSmooth() {
  if (!prefs.reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', (e) => {
      ScrollTrigger.update();
      listeners.forEach((fn) => fn(e.scroll, e.velocity));
    });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', () => {
      velocity = window.scrollY - lastY;
      lastY = window.scrollY;
      listeners.forEach((fn) => fn(window.scrollY, velocity));
    }, { passive: true });
  }
  if (document.documentElement.classList.contains('gate-on')) smooth.stop();
  return smooth;
}
