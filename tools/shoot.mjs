// Dev check: screenshot a route at scroll positions, report console errors and failed requests.
// node tools/shoot.mjs <path> <outDir> [--mobile] [--gate] [--ys=0,900,1800] [--wait=2500] [--reduced] [--nowebgl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const route = args[0] || '/';
const out = args[1] || 'shots';
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
fs.mkdirSync(out, { recursive: true });
const mobile = flag('mobile');
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', ...(flag('nowebgl') ? ['--disable-webgl', '--disable-3d-apis'] : [])],
});
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
  reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 220)}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
const tag = mobile ? 'm' : 'd';
const url = 'http://127.0.0.1:8000' + route + (flag('gate') ? '' : (route.includes('?') ? '&' : '?') + 'nogate');
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
if (flag('gate')) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${tag}-gate.jpg`), type: 'jpeg', quality: 75 });
  await page.waitForFunction(() => document.querySelector('[data-gate-pct]')?.textContent === '100', null, { timeout: 15000 }).catch(() => errors.push('gate never reached 100'));
  await page.screenshot({ path: path.join(out, `${tag}-gate-100.jpg`), type: 'jpeg', quality: 75 });
  // hold and sweep the can across the stencil, like a visitor would
  const vw = mobile ? 390 : 1440;
  const vh = mobile ? 844 : 900;
  await page.mouse.move(vw * 0.18, vh * 0.40);
  await page.mouse.down();
  for (let pass = 0; pass < 6; pass++) {
    const y = vh * (0.36 + pass * 0.04);
    const [x0, x1] = pass % 2 ? [vw * 0.84, vw * 0.16] : [vw * 0.16, vw * 0.84];
    await page.mouse.move(x1, y, { steps: 24 });
    if (pass === 2) await page.screenshot({ path: path.join(out, `${tag}-gate-spraying.jpg`), type: 'jpeg', quality: 75 });
  }
  await page.mouse.up();
  for (const ms of [200, 600, 1100, 1700, 2600]) {
    await page.waitForTimeout(ms === 200 ? 200 : 450);
    await page.screenshot({ path: path.join(out, `${tag}-enter-${ms}.jpg`), type: 'jpeg', quality: 75 });
  }
}
await page.waitForFunction(() => window.__bandrip?.ready, null, { timeout: 20000 }).catch(() => errors.push('boot never finished'));
const bootMs = Date.now() - t0;
await page.waitForTimeout(parseInt(opt('wait', '2500'), 10));
const ys = opt('ys', '0').split(',').map(Number);
for (const y of ys) {
  await page.evaluate((v) => { window.scrollTo(0, v); }, y);
  await page.waitForTimeout(1600);
  const real = await page.evaluate(() => Math.round(scrollY));
  await page.screenshot({ path: path.join(out, `${tag}-y${String(y).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 75 });
  if (real !== y) errors.push(`scroll requested ${y} got ${real}`);
}
const info = await page.evaluate(() => ({
  height: document.documentElement.scrollHeight,
  classes: document.documentElement.className,
  frames: window.__bandrip?.stats?.renderer?.frames,
}));
fs.writeFileSync(path.join(out, `${tag}-report.json`), JSON.stringify({ route, bootMs, info, errors }, null, 2));
console.log(JSON.stringify({ route, bootMs, info, errors: errors.slice(0, 25) }, null, 2));
await browser.close();
