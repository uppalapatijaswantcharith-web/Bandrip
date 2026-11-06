// End-to-end verification against a running server (default http://127.0.0.1:8000).
// node tools/verify.mjs [outDir]    — writes screenshots + verify-report.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUT = process.argv[2] || 'verify-output';
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, when: new Date().toISOString(), checks: [], perf: [], routes: [] };
const ok = (name, pass, detail = '') => { report.checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const GPU = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'];
const ROUTES = ['/', '/collections/', '/collections/jackets/', '/models/', '/about/', '/lookbook/', '/stores/'];

function watch(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/nope/')) errs.push(`http ${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
  return errs;
}
const ready = (page) => page.waitForFunction(() => window.__bandrip?.ready, null, { timeout: 25000 });

async function fps(page, ms = 4000) {
  return page.evaluate((dur) => new Promise((res) => {
    let n = 0;
    const deltas = [];
    let last = performance.now();
    const t0 = last;
    const tick = (now) => {
      deltas.push(now - last);
      last = now;
      n += 1;
      if (now - t0 < dur) requestAnimationFrame(tick);
      else {
        deltas.sort((a, b) => a - b);
        res({ fps: +(n / ((now - t0) / 1000)).toFixed(1), p95FrameMs: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), maxFrameMs: +deltas[deltas.length - 1].toFixed(1) });
      }
    };
    requestAnimationFrame(tick);
  }), ms);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: GPU });

// 1. every route, desktop + mobile
for (const mobile of [false, true]) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  for (const r of ROUTES) {
    const page = await ctx.newPage();
    const errs = watch(page);
    const t0 = Date.now();
    await page.goto(`${BASE}${r}?nogate`, { waitUntil: 'domcontentloaded' });
    const booted = await ready(page).then(() => true).catch(() => false);
    const bootMs = Date.now() - t0;
    await page.waitForTimeout(1800);
    const tag = `${mobile ? 'm' : 'd'}${r.replace(/\//g, '_') || '_'}`;
    await page.screenshot({ path: path.join(OUT, `${tag}top.jpg`), type: 'jpeg', quality: 70 });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((y) => scrollTo(0, y), Math.round(h * 0.45));
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(OUT, `${tag}mid.jpg`), type: 'jpeg', quality: 70 });
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, e) => s + (e.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.transferSize || 0));
    report.routes.push({ route: r, mobile, bootMs, booted, errors: errs, overflowX, transferKB: Math.round(bytes / 1024) });
    ok(`${mobile ? 'mobile' : 'desktop'} ${r} loads without errors`, booted && errs.length === 0, errs.slice(0, 3).join(' | '));
    ok(`${mobile ? 'mobile' : 'desktop'} ${r} has no horizontal overflow`, !overflowX);
    await page.close();
  }
  await ctx.close();
}

// 2. gate: keyboard entry, then skipped on repeat visit
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = watch(page);
  await page.goto(`${BASE}/`);
  const gateShown = await page.isVisible('[data-gate]');
  await page.waitForFunction(() => document.querySelector('[data-gate-pct]')?.textContent === '100', null, { timeout: 20000 }).catch(() => {});
  await page.focus('[data-gate-ring]');
  await page.keyboard.press('Enter');
  await ready(page).catch(() => {});
  await page.waitForTimeout(1500);
  const gateGone = !(await page.$('[data-gate]'));
  ok('gate shows on first visit', gateShown);
  ok('gate enters by keyboard (Enter)', gateGone);
  await page.screenshot({ path: path.join(OUT, 'gate-after-enter.jpg'), type: 'jpeg', quality: 70 });
  await page.goto(`${BASE}/about/`);
  await ready(page).catch(() => {});
  ok('gate skipped on repeat visit (session)', !(await page.isVisible('[data-gate]').catch(() => false)));
  // menu navigation with transition
  await page.click('.frame__menu');
  await page.waitForTimeout(700);
  const menuOpen = await page.isVisible('#menu');
  const focusInMenu = await page.evaluate(() => !!document.activeElement?.closest('#menu'));
  await page.screenshot({ path: path.join(OUT, 'menu-open.jpg'), type: 'jpeg', quality: 70 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const menuClosed = !(await page.isVisible('#menu'));
  await page.click('.frame__menu');
  await page.waitForTimeout(600);
  await Promise.all([page.waitForURL('**/models/', { timeout: 10000 }), page.click('#menu a[href="/models/"]')]);
  await ready(page).catch(() => {});
  ok('menu opens with focus inside', menuOpen && focusInMenu);
  ok('menu closes with Escape', menuClosed);
  ok('menu link navigates (mosaic transition) to /models/', page.url().endsWith('/models/'));
  ok('gate/menu flow produced no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  // skip link
  await page.keyboard.press('Tab');
  const skipFocused = await page.evaluate(() => document.activeElement?.classList.contains('skip-link'));
  ok('skip link is first in tab order', skipFocused);
  await ctx.close();
}

// 3. forms: client + server validation, prototype success
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = watch(page);
  await page.goto(`${BASE}/models/?nogate#apply`);
  await ready(page);
  await page.evaluate(() => document.querySelector('[data-apply-form]').scrollIntoView());
  await page.click('[data-apply-form] [type=submit]');
  await page.waitForTimeout(400);
  const errCount = await page.$$eval('[data-apply-form] .has-error', (els) => els.length);
  const focusedField = await page.evaluate(() => document.activeElement?.name);
  ok('apply form: empty submit shows inline errors', errCount >= 6, `${errCount} fields flagged, focus on ${focusedField}`);
  await page.screenshot({ path: path.join(OUT, 'form-errors.jpg'), type: 'jpeg', quality: 70 });
  await page.fill('#id_name', 'Asha Rao');
  await page.fill('#id_email', 'asha@example.com');
  await page.fill('#id_city', 'Hyderabad');
  await page.selectOption('#id_experience', 'none');
  await page.fill('#id_why', 'I want to learn runway walk and work with streetwear.');
  await page.check('#id_adult');
  await page.check('#id_consent');
  await page.click('[data-apply-form] [type=submit]');
  await page.waitForSelector('[data-apply-success]:not([hidden])', { timeout: 8000 }).catch(() => {});
  const successText = await page.textContent('[data-apply-success]').catch(() => '');
  ok('apply form: valid submit shows prototype success (nothing sent)', /nothing was sent/i.test(successText || ''));
  await page.screenshot({ path: path.join(OUT, 'form-success.jpg'), type: 'jpeg', quality: 70 });
  // server-side validation (bypassing the browser)
  const csrf = (await ctx.cookies()).find((c) => c.name === 'csrftoken')?.value;
  const bad = await page.request.post(`${BASE}/models/apply/`, { headers: { Accept: 'application/json', 'X-CSRFToken': csrf, Referer: `${BASE}/models/` }, form: { name: 'A1', email: 'nope', city: '', why: 'short' } });
  const badJson = await bad.json().catch(() => ({}));
  ok('server rejects invalid application (400 + field errors)', bad.status() === 400 && badJson.errors && Object.keys(badJson.errors).length >= 5, `status ${bad.status()}, fields: ${Object.keys(badJson.errors || {}).join(',')}`);
  const good = await page.request.post(`${BASE}/models/apply/`, { headers: { Accept: 'application/json', 'X-CSRFToken': csrf, Referer: `${BASE}/models/` }, form: { name: 'Asha Rao', email: 'asha@example.com', city: 'Hyderabad', experience: 'none', why: 'I want to learn runway walk properly.', adult: 'on', consent: 'on' } });
  const goodJson = await good.json().catch(() => ({}));
  ok('server accepts valid application as prototype only', good.status() === 200 && goodJson.ok && goodJson.prototype);
  // contact form
  await page.goto(`${BASE}/stores/?nogate`);
  await ready(page);
  const successHiddenInitially = await page.$eval('[data-contact-success]', (el) => el.hidden && getComputedStyle(el).display === 'none');
  ok('contact success state hidden before submit', successHiddenInitially);
  await page.evaluate(() => document.querySelector('[data-contact-form]').scrollIntoView());
  await page.fill('#id_name', 'Ravi');
  await page.fill('#id_email', 'ravi@example.com');
  await page.selectOption('#id_topic', 'stockist');
  await page.fill('#id_message', 'Interested in stocking BANDRIP.');
  await page.click('[data-contact-form] [type=submit]');
  await page.waitForSelector('[data-contact-success]:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('contact form: valid submit shows prototype success', await page.isVisible('[data-contact-success]'));
  ok('forms produced no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  const nf = await page.request.get(`${BASE}/collections/nope/`);
  ok('unknown category returns 404', nf.status() === 404);
  await ctx.close();
}

// 4. depot: select, history back, keyboard
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = watch(page);
  await page.goto(`${BASE}/collections/?nogate`);
  await ready(page);
  await page.waitForTimeout(2200);
  await page.focus('.depot__list a[data-cat="caps"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
  const openCaps = page.url().endsWith('/collections/caps/') && await page.isVisible('#cat-caps');
  await page.goBack();
  await page.waitForTimeout(1800);
  const closed = page.url().endsWith('/collections/?nogate') && !(await page.isVisible('#cat-caps'));
  await page.goForward();
  await page.waitForTimeout(1800);
  const reopened = await page.isVisible('#cat-caps');
  ok('depot: keyboard selection opens gallery and updates URL', openCaps);
  ok('depot: browser Back returns to the explorer', closed);
  ok('depot: browser Forward reopens the gallery', reopened);
  await page.click('#cat-caps [data-detail]');
  await page.waitForTimeout(500);
  const dlg = await page.evaluate(() => document.querySelector('[data-detail-dialog]').open);
  ok('depot: detail view opens', dlg);
  ok('depot flow produced no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// 5. reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = watch(page);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter').catch(() => {});
  await page.click('[data-gate-skip]').catch(() => {});
  await ready(page).catch(() => {});
  await page.waitForTimeout(1500);
  const cls = await page.evaluate(() => document.documentElement.className);
  const decoded = await page.evaluate(() => document.querySelector('.identity__title span')?.textContent);
  await page.screenshot({ path: path.join(OUT, 'reduced-motion.jpg'), type: 'jpeg', quality: 70 });
  ok('reduced motion: page enters, no smooth-scroll hijack', cls.includes('reduced-motion') && !cls.includes('lenis') && !(await page.$('[data-gate]')), cls);
  ok('reduced motion: headings are plain text (no scramble)', decoded === 'CUT FOR THE STREET.', decoded);
  ok('reduced motion produced no errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// 6. no WebGL fallback
{
  const b2 = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
  for (const r of ['/', '/collections/', '/models/']) {
    const page = await b2.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = watch(page);
    await page.goto(`${BASE}${r}?nogate`);
    await ready(page).catch(() => {});
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => document.documentElement.className);
    await page.screenshot({ path: path.join(OUT, `nowebgl${r.replace(/\//g, '_')}.jpg`), type: 'jpeg', quality: 70 });
    ok(`no-WebGL ${r}: composed fallback, no errors`, cls.includes('no-webgl') && errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  }
  await b2.close();
}

// 7. measured performance (headless Chrome, RTX GPU via ANGLE; not a real-device claim)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const r of ['/', '/collections/', '/models/']) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${r}?nogate`);
    await ready(page);
    await page.waitForTimeout(1500);
    const f = await fps(page, 4000);
    const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
    report.perf.push({ route: r, viewport: '1440x900', ...f, jsHeapMB: heap });
    console.log('PERF', r, JSON.stringify(f), 'heapMB', heap);
    await page.close();
  }
  await ctx.close();
}

await browser.close();
const failed = report.checks.filter((c) => !c.pass);
report.summary = { total: report.checks.length, failed: failed.length };
fs.writeFileSync(path.join(OUT, 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.checks.length - failed.length}/${report.checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
