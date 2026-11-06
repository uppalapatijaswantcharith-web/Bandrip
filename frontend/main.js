// BANDRIP boot: shared UI, then the page module, then gate/arrival, then the page entrance.
import './styles/base.css';
import './styles/home.css';
import './styles/depot.css';
import './styles/models.css';
import './styles/pages.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefs } from './core/prefs.js';
import { initSmooth, smooth } from './core/smooth.js';
import { loader } from './core/loader.js';
import { initFrame } from './ui/frame.js';
import { initMenu } from './ui/menu.js';
import { initDecode } from './ui/decode.js';
import { initChapters } from './ui/chapters.js';
import { initTransitions, arrive } from './ui/transitions.js';
import { runGate } from './ui/gate.js';
import { mosaic } from './ui/drips.js';

gsap.registerPlugin(ScrollTrigger);

const PAGES = {
  home: () => import('./pages/home.js'),
  depot: () => import('./pages/depot.js'),
  models: () => import('./pages/models.js'),
  simple: () => import('./pages/simple.js'),
};

async function boot() {
  initSmooth();
  initFrame();
  initMenu();
  const pageName = document.body.dataset.page || 'simple';
  const mod = await (PAGES[pageName] || PAGES.simple)();
  const page = (await mod.init({ prefs, smooth, loader })) || {};
  initDecode();
  initChapters();
  initTransitions({ beforeLeave: page.beforeLeave });

  // fonts count as an asset
  loader.track(document.fonts?.ready, 0.5);

  const ready = Promise.race([loader.whenDone(7000), page.ready || Promise.resolve()]);
  const gated = await runGate();
  if (gated) {
    await ready;
    smooth.start();
    page.enter?.({ fromGate: true });
    await mosaic.reveal();
  } else {
    const arrived = await arrive(ready);
    page.enter?.({ fromGate: false, arrived });
  }
  ScrollTrigger.refresh();
  window.__bandrip = { ready: true, page: pageName, stats: page.stats };
}

boot().catch((err) => {
  // never trap the visitor behind the gate or mosaic
  console.error(err);
  document.documentElement.classList.remove('gate-on', 'arriving');
  document.querySelector('[data-gate]')?.remove();
  mosaic.hide();
  smooth.start();
});
