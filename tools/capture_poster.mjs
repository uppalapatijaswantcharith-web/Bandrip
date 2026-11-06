// Captures the hero mascot from the live WebGL scene as a transparent poster (static/img/mascot-poster.webp source).
// node tools/capture_poster.mjs <out.png>
import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await p.goto('http://127.0.0.1:8000/?nogate');
await p.waitForFunction(() => window.__bandrip?.ready);
await p.mouse.move(720, 450);
await p.waitForTimeout(3500);
await p.addStyleTag({ content: 'body > *:not(main), main > *:not(.stage), .grain, .frame { visibility: hidden !important; } html, body { background: transparent !important; }' });
await p.waitForTimeout(600);
await p.locator('[data-stage]').screenshot({ path: out, omitBackground: true });
await b.close();
