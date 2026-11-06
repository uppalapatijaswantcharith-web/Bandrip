// Copies static/ (including the fresh Vite build in static/dist) into public/static
// so Vercel's CDN serves it directly at /static/... without hitting Django.
import { cpSync, rmSync, existsSync } from 'node:fs';

if (!existsSync('static/dist/.vite/manifest.json')) {
  console.error('static/dist is missing; run `vite build` first.');
  process.exit(1);
}
rmSync('public', { recursive: true, force: true });
cpSync('static', 'public/static', { recursive: true });
console.log('Copied static/ -> public/static');
