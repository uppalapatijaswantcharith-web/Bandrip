// Page-to-page mosaic transition. Real links stay real: no-JS and new-tab navigation still work.
import { mosaic } from './drips.js';

let leaving = false;

function isInternal(a, e) {
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download') || a.dataset.local !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith('/static/')) return false;
  if (url.pathname === location.pathname && url.hash) return false;
  return true;
}

export function initTransitions({ beforeLeave } = {}) {
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href]');
    if (!isInternal(a, e) || leaving) return;
    e.preventDefault();
    leaving = true;
    try { sessionStorage.setItem('bandrip-transition', '1'); } catch { /* ignore */ }
    await beforeLeave?.();
    await mosaic.cover();
    location.href = a.href;
    setTimeout(() => { leaving = false; }, 1500);
  });
}

/** Called on load for pages reached through a transition. */
export async function arrive(ready) {
  const html = document.documentElement;
  if (!html.classList.contains('arriving')) return false;
  mosaic.coverNow();
  try { sessionStorage.removeItem('bandrip-transition'); } catch { /* ignore */ }
  await Promise.race([ready, new Promise((r) => setTimeout(r, 2200))]);
  await mosaic.reveal();
  return true;
}
