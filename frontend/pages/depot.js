// Collections: spatial category explorer + galleries with real URLs and Back support.
import { gsap } from 'gsap';
import { decodeTo, initDecode } from '../ui/decode.js';
import { setFrameLabel } from '../ui/frame.js';

export async function init({ prefs, smooth, loader }) {
  const root = document.querySelector('[data-depot]');
  const canvas = document.querySelector('[data-depot-canvas]');
  const label = document.querySelector('[data-depot-label]');
  const labelNum = document.querySelector('[data-depot-label-num]');
  const labelName = document.querySelector('[data-depot-label-name]');
  const wash = document.querySelector('[data-depot-wash]');
  const listLinks = [...document.querySelectorAll('.depot__list a[data-cat]')];
  const galleries = new Map([...document.querySelectorAll('[data-gallery]')].map((g) => [g.dataset.gallery, g]));
  const categories = [...galleries.values()].map((g) => ({ slug: g.dataset.gallery, num: g.dataset.num, name: g.dataset.name, field: g.style.getPropertyValue('--g-field').trim(), object: null }));
  const OBJ = { 'oversized-tees': 'tee', shirts: 'shirt', jackets: 'jacket', 'pants-cargos': 'pants', caps: 'cap', sunglasses: 'shades', 'bandanas-accessories': 'bandana' };
  categories.forEach((c) => { c.object = OBJ[c.slug]; });

  let rt = null;
  let depot = null;
  let openSlug = null;
  let busy = false;

  if (prefs.webgl && canvas) {
    const setP = loader.add(5);
    try {
      const [{ createRenderer }, { createDepotScene }] = await Promise.all([import('../core/renderer.js'), import('../scenes/depot.js')]);
      rt = createRenderer(canvas, { alpha: false });
      depot = await createDepotScene(rt, { categories, mobile: prefs.mobile, onProgress: setP });
      setP(1);
      rt.start((dt) => depot.frame(dt));
      document.documentElement.classList.add('depot-ready');
    } catch (err) {
      console.warn('[bandrip] depot 3D unavailable', err);
      setP(1);
    }
  }

  const itemFor = (slug) => depot?.items.find((it) => it.cat.slug === slug) || null;

  // ---- hover / focus
  function setHover(slug) {
    const item = slug ? itemFor(slug) : null;
    if (depot) depot.setHover(item);
    listLinks.forEach((a) => a.classList.toggle('is-hover', a.dataset.cat === slug));
    canvas.style.cursor = item ? 'pointer' : '';
    if (!item || openSlug) { label.classList.remove('is-on'); return; }
    const cat = item.cat;
    if (labelName.dataset.final !== cat.name) { labelNum.textContent = `${cat.num} / 07`; decodeTo(labelName, cat.name, { duration: 360 }); }
    label.classList.add('is-on');
  }
  function trackLabel() {
    const item = depot?.hovered;
    if (item && !openSlug) {
      const s = depot.screenPos(item);
      label.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, 12px)`;
    }
  }
  if (depot) {
    gsap.ticker.add(trackLabel);
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      depot.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      if (openSlug || busy || prefs.touch) return;
      const hit = depot.hitTest(e.clientX, e.clientY, r);
      setHover(hit ? hit.cat.slug : null);
    });
    canvas.addEventListener('pointerleave', () => setHover(null));
    canvas.addEventListener('click', (e) => {
      if (openSlug || busy) return;
      const hit = depot.hitTest(e.clientX, e.clientY, canvas.getBoundingClientRect());
      if (hit) open(hit.cat.slug, { push: true });
    });
  }
  listLinks.forEach((a) => {
    a.addEventListener('mouseenter', () => setHover(a.dataset.cat));
    a.addEventListener('focus', () => setHover(a.dataset.cat));
    a.addEventListener('mouseleave', () => setHover(null));
    a.addEventListener('blur', () => setHover(null));
  });

  // ---- open / close with camera move, colour wash and gallery rise
  async function open(slug, { push = false, instant = false } = {}) {
    const g = galleries.get(slug);
    if (!g || busy) return;
    busy = true;
    if (openSlug && openSlug !== slug) galleries.get(openSlug).hidden = true;
    openSlug = slug;
    setHover(null);
    if (push) history.pushState({ slug }, '', `/collections/${slug}/`);
    const item = itemFor(slug);
    const field = g.style.getPropertyValue('--g-field').trim();
    setFrameLabel(`DEPOT // ${g.dataset.num}`);
    if (depot && item && !instant && !prefs.reduced) {
      const f = depot.focusPose(item);
      const s = depot.screenPos(item);
      wash.style.setProperty('--wash', field);
      wash.style.setProperty('--wx', `${s.x}px`);
      wash.style.setProperty('--wy', `${s.y + 120}px`);
      const tl = gsap.timeline();
      tl.to(depot.cam.pos, { x: f.pos.x, y: f.pos.y, z: f.pos.z, duration: 1.1, ease: 'power3.inOut' }, 0)
        .to(depot.cam.look, { x: f.look.x, y: f.look.y, z: f.look.z, duration: 1.1, ease: 'power3.inOut' }, 0)
        .to(item.holder.rotation, { y: `+=${Math.PI * 2}`, duration: 1.1, ease: 'power2.inOut' }, 0)
        .fromTo(wash, { clipPath: `circle(0% at ${s.x}px ${s.y + 120}px)` }, { clipPath: `circle(150% at ${s.x}px ${s.y + 120}px)`, duration: 0.7, ease: 'power2.in' }, 0.55);
      await tl.then();
    } else if (depot && item) {
      const f = depot.focusPose(item);
      depot.cam.pos.copy(f.pos);
      depot.cam.look.copy(f.look);
    }
    showGallery(g, instant);
    rt?.pause();
    busy = false;
  }

  function showGallery(g, instant) {
    g.hidden = false;
    g.scrollTop = 0;
    if (!document.documentElement.classList.contains('depot-ready')) {
      smooth.scrollTo(g, { immediate: true });
    } else {
      smooth.stop();
    }
    initDecode(g);
    if (!instant && !prefs.reduced) {
      g.classList.add('is-entering');
      const els = [...g.querySelectorAll('.gallery__head > *, .g-item')];
      els.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i, 10) * 60}ms`; });
      requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('is-entering')));
    }
    g.querySelector('.gallery__title')?.setAttribute('tabindex', '-1');
    g.querySelector('.gallery__title')?.focus({ preventScroll: true });
    document.getElementById('live-region').textContent = `${g.dataset.name} gallery opened`;
  }

  async function close({ push = false } = {}) {
    if (!openSlug || busy) return;
    busy = true;
    const g = galleries.get(openSlug);
    const slug = openSlug;
    if (push) history.pushState({}, '', '/collections/');
    setFrameLabel('DEPOT');
    rt?.resume();
    if (!prefs.reduced) await gsap.to(g, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'power3.in' }).then();
    g.hidden = true;
    g.style.clipPath = '';
    openSlug = null;
    smooth.start();
    if (depot) {
      gsap.to(wash, { clipPath: 'circle(0% at 50% 50%)', duration: prefs.reduced ? 0 : 0.6, ease: 'power2.out' });
      const tl = gsap.timeline();
      tl.to(depot.cam.pos, { x: depot.home.pos.x, y: depot.home.pos.y, z: depot.home.pos.z, duration: prefs.reduced ? 0 : 1.1, ease: 'power3.inOut' }, 0)
        .to(depot.cam.look, { x: depot.home.look.x, y: depot.home.look.y, z: depot.home.look.z, duration: prefs.reduced ? 0 : 1.1, ease: 'power3.inOut' }, 0);
      await tl.then();
    }
    busy = false;
    listLinks.find((a) => a.dataset.cat === slug)?.focus({ preventScroll: true });
  }

  // links inside the page (list, back, "more categories") use history instead of reloads
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-local]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (!document.documentElement.classList.contains('depot-ready')) return;   // no 3D: normal navigation
    e.preventDefault();
    if (a.hasAttribute('data-back')) { close({ push: true }); return; }
    const slug = a.dataset.cat;
    if (openSlug && openSlug !== slug) {
      galleries.get(openSlug).hidden = true;
      openSlug = null;
      busy = false;
      open(slug, { push: true, instant: true });
    } else open(slug, { push: true });
  });
  window.addEventListener('popstate', () => {
    const m = location.pathname.match(/^\/collections\/([^/]+)\/?$/);
    if (m && galleries.has(m[1])) open(m[1]);
    else close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openSlug && !document.querySelector('[data-detail-dialog]').open) close({ push: true });
  });

  // ---- detail dialog
  const dlg = document.querySelector('[data-detail-dialog]');
  let detailList = [];
  let detailIndex = 0;
  const showDetail = (i) => {
    detailIndex = (i + detailList.length) % detailList.length;
    const b = detailList[detailIndex];
    dlg.querySelector('[data-detail-img]').src = b.dataset.src;
    dlg.querySelector('[data-detail-img]').alt = b.dataset.alt;
    dlg.querySelector('[data-detail-name]').textContent = b.dataset.name;
    dlg.querySelector('[data-detail-code]').textContent = `${b.dataset.code} · DEMO PIECE`;
    const credit = dlg.querySelector('[data-detail-credit]');
    credit.textContent = b.dataset.credit;
    credit.href = b.dataset.source;
    const g = b.closest('[data-gallery]');
    dlg.querySelector('[data-detail-spec]').innerHTML = [...g.querySelectorAll('.gallery__intro .spec li')].map((li) => `<li>${li.textContent}</li>`).join('');
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-detail]');
    if (!b) return;
    detailList = [...b.closest('[data-gallery]').querySelectorAll('[data-detail]')];
    showDetail(detailList.indexOf(b));
    dlg.showModal();
  });
  dlg.querySelector('[data-detail-prev]').addEventListener('click', () => showDetail(detailIndex - 1));
  dlg.querySelector('[data-detail-next]').addEventListener('click', () => showDetail(detailIndex + 1));
  dlg.querySelector('[data-detail-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') showDetail(detailIndex + 1);
    if (e.key === 'ArrowLeft') showDetail(detailIndex - 1);
  });

  // deep link: open the requested category immediately
  const initial = root.dataset.active;
  if (initial && depot) open(initial, { instant: true });
  else if (initial) openSlug = initial;

  return {
    ready: loader.whenDone(8000),
    enter() {
      if (prefs.reduced || openSlug) return;
      if (depot) {
        const from = { z: depot.home.pos.z + 6, y: depot.home.pos.y + 2 };
        gsap.from(depot.cam.pos, { z: from.z, y: from.y, duration: 2.0, ease: 'expo.out' });
      }
      gsap.from('.depot__list li', { x: -20, autoAlpha: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05, delay: 0.2 });
    },
    stats: rt?.stats,
  };
}
