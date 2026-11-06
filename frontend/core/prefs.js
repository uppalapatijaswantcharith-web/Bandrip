// User/device preferences, read once at boot.
const html = document.documentElement;

function hasWebGL() {
  if (/[?&]nowebgl\b/.test(location.search)) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefs = {
  reduced: mqReduced.matches,
  webgl: hasWebGL(),
  touch: window.matchMedia('(hover: none), (pointer: coarse)').matches,
  mobile: window.matchMedia('(max-width: 760px)').matches,
};

html.classList.toggle('reduced-motion', prefs.reduced);
html.classList.toggle('no-webgl', !prefs.webgl);
html.classList.toggle('touch', prefs.touch);
mqReduced.addEventListener?.('change', (e) => {
  prefs.reduced = e.matches;
  html.classList.toggle('reduced-motion', e.matches);
});
