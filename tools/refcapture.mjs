// Research tool: captures entrance + scroll behaviour of reference sites.
// Usage: node tools/refcapture.mjs <name> <url> <outDir> [steps] [stepPx]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , name, url, outRoot, stepsArg = '14', stepPxArg = '700'] = process.argv;
const out = path.join(outRoot, name);
fs.mkdirSync(out, { recursive: true });
const steps = parseInt(stepsArg, 10);
const stepPx = parseInt(stepPxArg, 10);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-webgl'],
});

async function inspect(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        sel, text: (el.innerText || '').slice(0, 120),
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color,
        textTransform: cs.textTransform,
      };
    };
    const fonts = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`);
    const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
      w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
      pos: getComputedStyle(c).position,
    }));
    const links = [...document.querySelectorAll('nav a, header a, a')].slice(0, 40)
      .map((a) => (a.innerText || a.getAttribute('aria-label') || '').trim()).filter(Boolean);
    const scripts = [...document.scripts].map((s) => s.src).filter(Boolean)
      .map((s) => s.split('/').pop().split('?')[0]);
    const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 30)
      .map((h) => `${h.tagName}: ${(h.innerText || '').replace(/\s+/g, ' ').slice(0, 90)}`);
    return {
      title: document.title,
      scrollHeight: document.documentElement.scrollHeight,
      viewport: [innerWidth, innerHeight],
      htmlClass: document.documentElement.className,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      libs: {
        gsap: !!window.gsap, ScrollTrigger: !!window.ScrollTrigger, lenis: !!window.lenis || !!window.Lenis
          || document.documentElement.className.includes('lenis'),
        three: !!window.THREE || !!window.__THREE__, webflow: !!window.Webflow,
      },
      fonts: [...new Set(fonts)].slice(0, 40),
      type: ['h1', 'h2', 'h3', 'p', 'nav a', 'header a', 'button', 'body'].map(pick).filter(Boolean),
      canvases, links: [...new Set(links)].slice(0, 40), scripts, headings,
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2500),
    };
  });
}

async function run(viewport, tag, nSteps) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: tag === 'mobile', hasTouch: tag === 'mobile' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    errors.push('goto: ' + e.message.slice(0, 200));
  }
  for (const t of [600, 1800, 3500, 6500, 10000]) {
    const wait = t - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(out, `${tag}-load-${t}.jpg`), type: 'jpeg', quality: 70 });
  }
  const info = await inspect(page).catch((e) => ({ err: e.message }));
  // pointer move to reveal hover/parallax response
  await page.mouse.move(viewport.width * 0.2, viewport.height * 0.3);
  await page.waitForTimeout(400);
  await page.mouse.move(viewport.width * 0.8, viewport.height * 0.7, { steps: 12 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${tag}-pointer.jpg`), type: 'jpeg', quality: 70 });
  for (let i = 1; i <= nSteps; i++) {
    if (tag === 'mobile') await page.evaluate((y) => window.scrollBy(0, y), stepPx);
    else {
      for (let k = 0; k < 7; k++) { await page.mouse.wheel(0, stepPx / 7); await page.waitForTimeout(30); }
    }
    await page.waitForTimeout(1100);
    const y = await page.evaluate(() => Math.round(scrollY));
    await page.screenshot({ path: path.join(out, `${tag}-scroll-${String(i).padStart(2, '0')}-y${y}.jpg`), type: 'jpeg', quality: 70 });
  }
  fs.writeFileSync(path.join(out, `${tag}-info.json`), JSON.stringify({ url, info, errors }, null, 2));
  await ctx.close();
}

await run({ width: 1440, height: 900 }, 'desktop', steps);
await run({ width: 390, height: 844 }, 'mobile', Math.min(6, steps));
await browser.close();
console.log('done', name);
