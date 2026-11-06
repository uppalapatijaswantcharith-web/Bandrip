// Models / Studio: runway scene, controls, reveals, portfolio filter, demo application form.
import { enhanceForm } from '../ui/form.js';

export async function init({ prefs, loader }) {
  const canvas = document.querySelector('[data-runway-canvas]');
  let rt = null;
  let runway = null;

  if (prefs.webgl && canvas) {
    const setP = loader.add(4);
    try {
      const [{ createRenderer }, { createRunwayScene }] = await Promise.all([import('../core/renderer.js'), import('../scenes/runway.js')]);
      rt = createRenderer(canvas, { alpha: false });
      runway = await createRunwayScene(rt, { mobile: prefs.mobile, onProgress: setP, canvas });
      setP(1);
      if (prefs.reduced) runway.setPaused(true);
      rt.start((dt) => runway.frame(dt));
      document.documentElement.classList.add('runway-ready');
    } catch (err) {
      console.warn('[bandrip] runway 3D unavailable, editorial fallback in use', err);
      setP(1);
    }
  }

  // controls
  const viewBtns = [...document.querySelectorAll('[data-view]')];
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    viewBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    runway?.setView(b.dataset.view);
  }));
  const lightsBtn = document.querySelector('[data-lights]');
  lightsBtn?.addEventListener('click', () => {
    const p = runway?.nextPalette();
    if (p) lightsBtn.querySelector('[data-lights-name]').textContent = p.name;
  });
  const pauseBtn = document.querySelector('[data-pause]');
  if (pauseBtn && prefs.reduced) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.textContent = 'PLAY'; }
  pauseBtn?.addEventListener('click', () => {
    const paused = runway?.togglePause();
    pauseBtn.setAttribute('aria-pressed', String(!!paused));
    pauseBtn.textContent = paused ? 'PLAY' : 'PAUSE';
  });

  // reveals
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // portfolio filter
  const filterBtns = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-portfolio] [data-tag]')];
  filterBtns.forEach((b) => b.addEventListener('click', () => {
    filterBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cards.forEach((c) => c.classList.toggle('is-hidden', b.dataset.filter !== 'all' && c.dataset.tag !== b.dataset.filter));
    document.getElementById('live-region').textContent = `${cards.filter((c) => !c.classList.contains('is-hidden')).length} looks shown`;
  }));

  // application form (prototype)
  const form = document.querySelector('[data-apply-form]');
  const success = document.querySelector('[data-apply-success]');
  enhanceForm(form, {
    onSuccess: (data, fd) => {
      form.hidden = true;
      success.hidden = false;
      success.querySelector('[data-success-name]').textContent = (fd.get('name') || '').toString().split(' ')[0].toUpperCase();
      success.focus();
    },
  });
  document.querySelector('[data-apply-reset]')?.addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    form.querySelector('input:not([type=hidden])')?.focus();
  });

  return {
    ready: loader.whenDone(8000),
    stats: rt?.stats,
    enter() {},
  };
}
