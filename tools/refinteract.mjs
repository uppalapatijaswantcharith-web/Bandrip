// Research tool: interactive capture for gated reference experiences.
// Usage: node tools/refinteract.mjs <site> <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , site, outRoot] = process.argv;
const out = path.join(outRoot, site + '-i');
fs.mkdirSync(out, { recursive: true });
const useBundled = process.env.BUNDLED === '1';
const browser = await chromium.launch({
  ...(useBundled ? {} : { channel: 'chrome' }),
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const log = [];
page.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 160)));
let n = 0;
const shot = async (label) => {
  n += 1;
  const f = `${String(n).padStart(3, '0')}-${label}.jpg`;
  await page.screenshot({ path: path.join(out, f), type: 'jpeg', quality: 72 });
  return f;
};
const wait = (ms) => page.waitForTimeout(ms);
const wheel = async (dy, slices = 6) => { for (let i = 0; i < slices; i++) { await page.mouse.wheel(0, dy / slices); await wait(35); } };
const textOf = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400));
async function waitForGone(re, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const t = await textOf().catch(() => '');
    if (!re.test(t)) return Date.now() - t0;
    await wait(1000);
  }
  return -1;
}

const urls = {
  dich: 'https://dich-fashion.webflow.io/',
  lusion: 'https://lusion.co/',
  passerella: 'https://exp-infinite-passerella.lusion.co/',
  miumiu: 'https://immersivebags.miumiu.com/en/',
  norblack: 'https://norblacknorwhite.in/',
};
await page.goto(urls[site], { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => log.push('goto ' + e.message.slice(0, 160)));

if (site === 'dich') {
  const t = await waitForGone(/(^|\s)\d{1,2} %/, 45000);
  log.push('loader gone after ' + t);
  await shot('loaded');
  const btn = page.locator('text=DISCOVER').first();
  const box = await btn.boundingBox().catch(() => null);
  log.push('discover box ' + JSON.stringify(box));
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await wait(600); await shot('discover-hover');
    await page.mouse.down();
    for (let i = 0; i < 5; i++) { await wait(700); await shot('hold-' + i); }
    await page.mouse.up();
    await btn.click({ force: true }).catch(() => {});
  }
  for (const ms of [300, 800, 1600, 3000, 5000]) { await wait(ms === 300 ? 300 : ms - 300); await shot('enter-' + ms); }
  await page.mouse.move(300, 300, { steps: 10 }); await page.mouse.move(1100, 650, { steps: 20 }); await wait(500); await shot('pointer');
  for (let i = 0; i < 26; i++) {
    await wheel(450); await wait(900);
    const y = await page.evaluate(() => Math.round(scrollY));
    await shot(`scroll-y${y}`);
  }
  const menu = page.locator('text=MENU').first();
  await page.evaluate(() => scrollTo(0, 0)); await wait(1200);
  await menu.click({ force: true }).catch((e) => log.push('menu ' + e.message.slice(0, 80)));
  await wait(400); await shot('menu-open-400'); await wait(1200); await shot('menu-open-1600');
}

if (site === 'lusion') {
  await wait(1500); await shot('t1500');
  for (const ms of [3000, 5000, 8000]) { await wait(ms - 1500); await shot('t' + ms); }
  await page.mouse.move(200, 200); await page.mouse.move(1200, 700, { steps: 25 }); await wait(500); await shot('pointer');
  for (let i = 0; i < 28; i++) {
    await wheel(500); await wait(900);
    const y = await page.evaluate(() => Math.round(scrollY));
    await shot(`scroll-y${y}`);
  }
  const info = await page.evaluate(() => ({
    fonts: [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status),
    h: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.innerText.replace(/\s+/g, ' ').slice(0, 80)),
    canvases: [...document.querySelectorAll('canvas')].map((c) => [c.width, c.height, getComputedStyle(c).position]),
    links: [...document.querySelectorAll('a')].map((a) => a.innerText.trim()).filter(Boolean).slice(0, 40),
  }));
  log.push(JSON.stringify(info));
}

if (site === 'passerella') {
  const t = await waitForGone(/EXPERIENCE IS LOADING/, 120000);
  log.push('loader gone after ' + t);
  await shot('loaded');
  for (let i = 0; i < 4; i++) { await wait(1500); await shot('idle-' + i); }
  await page.mouse.click(720, 450); await wait(1200); await shot('after-click');
  for (let i = 0; i < 6; i++) { await wait(1500); await shot('run-' + i); }
  await page.mouse.move(200, 450); await page.mouse.down(); await page.mouse.move(1200, 450, { steps: 30 }); await page.mouse.up();
  await wait(800); await shot('drag');
  for (let i = 0; i < 6; i++) { await wheel(400); await wait(900); await shot('wheel-' + i); }
  const btns = await page.evaluate(() => [...document.querySelectorAll('button, [role=button], a, h3')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 30));
  log.push('buttons ' + JSON.stringify(btns));
  await page.locator('text=ABOUT').first().click({ force: true }).catch(() => {});
  await wait(1500); await shot('about');
}

if (site === 'miumiu') {
  await wait(4000); await shot('start');
  const t = await waitForGone(/Explore the new bag collection/, 15000);
  log.push('intro gone ' + t);
  // try clicking spinner / entering
  await page.mouse.click(720, 780); await wait(2500); await shot('after-click-spinner');
  await page.mouse.click(720, 450); await wait(2500); await shot('after-click-center');
  for (let i = 0; i < 8; i++) { await wait(1500); await shot('t-' + i); }
  await page.mouse.move(300, 450, { steps: 10 }); await wait(800); await shot('hover-left');
  await page.mouse.move(1140, 450, { steps: 20 }); await wait(800); await shot('hover-right');
  for (let i = 0; i < 6; i++) { await wheel(500); await wait(1200); await shot('wheel-' + i); }
  await page.mouse.move(200, 450); await page.mouse.down(); await page.mouse.move(1100, 450, { steps: 30 }); await page.mouse.up(); await wait(1200); await shot('drag');
  const els = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button]')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40));
  log.push('controls ' + JSON.stringify(els));
  log.push('text ' + await textOf());
}

if (site === 'norblack') {
  await wait(5000);
  // dismiss popups
  await page.keyboard.press('Escape');
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 500)); await wait(1300);
    const y = await page.evaluate(() => Math.round(scrollY));
    await shot('home-y' + y);
  }
  const links = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => [a.innerText.trim().slice(0, 40), a.href]).filter((x) => x[0]));
  fs.writeFileSync(path.join(out, 'links.json'), JSON.stringify(links, null, 1));
  const want = links.filter(([t, h]) => /lookbook|about|universe|collections\//i.test(h)).slice(0, 4);
  for (const [t, h] of want) {
    await page.goto(h, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await wait(4500); await shot('page-' + t.replace(/\W+/g, '_'));
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 700)); await wait(1300); await shot('page-' + t.replace(/\W+/g, '_') + '-s' + i); }
  }
  const info = await page.evaluate(() => ({
    fonts: [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status),
    type: ['h1', 'h2', 'p', 'a', 'body'].map((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return [s, c.fontFamily, c.fontSize, c.fontWeight, c.letterSpacing, c.textTransform]; }),
  }));
  log.push(JSON.stringify(info));
}

fs.writeFileSync(path.join(out, 'log.txt'), log.join('\n'));
await browser.close();
console.log('done', site);
