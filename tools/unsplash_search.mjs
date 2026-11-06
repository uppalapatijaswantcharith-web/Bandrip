// Asset research tool: collects Unsplash search candidates (free Unsplash License only).
// Usage: node tools/unsplash_search.mjs <outJson> <query> [<query> ...]
// Unsplash+ results (plus.unsplash.com) are excluded: they use a different, paid licence.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , outJson, ...queries] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const results = fs.existsSync(outJson) ? JSON.parse(fs.readFileSync(outJson, 'utf8')) : {};

for (const q of queries) {
  const url = `https://unsplash.com/s/photos/${encodeURIComponent(q.replace(/\s+/g, '-'))}?license=free`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(900); }
    const items = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('figure').forEach((fig) => {
        const a = fig.querySelector('a[href^="/photos/"]');
        const img = fig.querySelector('img[src*="images.unsplash.com/photo-"]');
        if (!a || !img) return;
        const author = fig.querySelector('a[href^="/@"]');
        const plus = fig.innerText.includes('Unsplash+') || fig.querySelector('img[src*="plus.unsplash.com"]');
        if (plus) return;
        const src = img.getAttribute('src');
        out.push({
          page: 'https://unsplash.com' + a.getAttribute('href'),
          base: src.split('?')[0],
          alt: img.getAttribute('alt') || '',
          author: author ? author.innerText.trim() : '',
          authorUrl: author ? 'https://unsplash.com' + author.getAttribute('href') : '',
          w: img.naturalWidth, h: img.naturalHeight,
        });
      });
      return out;
    });
    const seen = new Set();
    results[q] = items.filter((x) => (seen.has(x.base) ? false : seen.add(x.base)));
    console.log(q, results[q].length);
  } catch (e) {
    console.log('fail', q, e.message.slice(0, 120));
  }
}
fs.writeFileSync(outJson, JSON.stringify(results, null, 1));
await browser.close();
