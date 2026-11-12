/* Twodo · after `next build`:
   1. Content-Security-Policy: Next's static pages carry a few inline <script> blocks (the React payload). We hash each
      one and allow exactly those, so the strict policy of the original app ("only this site's own scripts") stays.
   2. Service worker: list every file of the build for offline use, and version the cache by their content. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(OUT);

const origin = u => { try { return u ? new URL(u).origin : ''; } catch { return ''; } };
const connect = new Set(["'self'", 'https://*.firebaseio.com', 'https://*.firebasedatabase.app', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com']);
for (const u of [process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, process.env.NEXT_PUBLIC_AUTH_EMULATOR]) {
  const o = origin(u);
  if (o && !/^https:\/\/[^/]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(o)) connect.add(o); // e.g. a local emulator for tests
}

let pages = 0;
for (const f of files.filter(f => f.endsWith('.html'))) {
  let html = readFileSync(f, 'utf8');
  const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1]) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  const csp = [
    "default-src 'self'", `script-src 'self' ${[...hashes].join(' ')}`.trim(), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self'", "media-src 'self' data: blob:", `connect-src ${[...connect].join(' ')}`, "worker-src 'self'", "manifest-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-src 'none'",
  ].join('; ');
  if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error(`${f} already has a CSP`);
  html = html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
  writeFileSync(f, html); pages++;
}

const rel = p => relative(OUT, p).split(sep).join('/');
const shell = files.map(rel).filter(p => p !== 'sw.js' && !p.endsWith('.txt') && !p.endsWith('.map') && p !== '.nojekyll')
  .sort().map(p => (p === 'index.html' ? './' : p));
const h = createHash('sha256');
for (const f of files.filter(f => rel(f) !== 'sw.js').sort()) h.update(rel(f)).update(readFileSync(f));
const version = 'twodo-v4-' + h.digest('hex').slice(0, 12);
const swPath = join(OUT, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace("const VERSION = 'twodo-dev';", `const VERSION = '${version}';`).replace("const SHELL = ['./'];", `const SHELL = ${JSON.stringify(shell)};`);
if (!sw.includes(version)) throw new Error('sw.js placeholders not found');
writeFileSync(swPath, sw);
writeFileSync(join(OUT, '.nojekyll'), ''); // GitHub Pages: serve the _next folder as-is
console.log(`postbuild: CSP added to ${pages} page(s); service worker ${version} caches ${shell.length} files`);
