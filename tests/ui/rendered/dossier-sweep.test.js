// Rendered check: opens dossiers in the dev harness in Chromium and asserts no x-scroll, taps >= 44 px and fonts >= 12 px on every page.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SIZES = [[360, 740], [390, 844], [600, 900], [820, 1180], [1280, 900]];
const PEOPLE = ['temiwa', 'marro', 'dren'];

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > 8899) { reject(new Error('no free port in 8800-8899')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8800);
  });
}

/** Runs in the page: returns every layout problem inside the open dossier. */
function audit() {
  const root = document.querySelector('#hx-frame .dossier');
  const seen = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
  const problems = [];
  if (!root) return ['no dossier is open'];
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`x-scroll ${document.documentElement.scrollWidth} > ${innerWidth}`);
  const box = root.getBoundingClientRect();
  for (const el of root.querySelectorAll('*')) {
    if (!seen(el) || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.right > box.right + 1 || r.left < box.left - 1) problems.push(`outside: ${label(el)} ${Math.round(r.left)}-${Math.round(r.right)}`);
  }
  for (const el of root.querySelectorAll('button, a, [data-tap]')) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) problems.push(`tap: ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${el.textContent.trim().slice(0, 16)}"`);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || done.has(el) || !n.textContent.trim() || el.closest('svg') || !seen(el)) continue;
    done.add(el);
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) problems.push(`font: ${label(el)} ${size}px "${n.textContent.trim().slice(0, 20)}"`);
  }
  return problems;
}

let ctx = null;
test.before(async () => {
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const { server, port } = await serve();
    ctx = { browser, server, port };
  } catch (err) {
    if (process.env.CI === 'true') throw err;
    ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
  }
});
test.after(async () => {
  if (ctx?.browser) await ctx.browser.close();
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const theme of ['dark', 'light']) {
  for (const [width, height] of SIZES) {
    test(`dossiers at ${width}x${height} in ${theme}: every page fits, taps >= 44, font >= 12`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=people`);
        await page.waitForSelector('#hx-frame .su-host');
        for (const id of PEOPLE) {
          await page.evaluate((x) => {
            if (!document.querySelector(`#hx-frame [data-person-id="${x}"]`)) document.querySelector('#hx-frame [data-filter="deceased"]').click();
            document.querySelector(`#hx-frame [data-person-id="${x}"]`).click();
          }, id);
          await settle(page);
          assert.deepEqual(await page.evaluate(audit), [], `${id} cards @${width} ${theme}`);
          const pages = await page.evaluate(() => [...document.querySelectorAll('#hx-frame .dossier .dcard')].map(c => c.dataset.page));
          for (const p of pages) {
            await page.evaluate(x => document.querySelector(`#hx-frame .dossier [data-page="${x}"]`).click(), p);
            await settle(page);
            assert.deepEqual(await page.evaluate(audit), [], `${id}/${p} @${width} ${theme}`);
            await page.evaluate(() => document.querySelector('#hx-frame .dossier .pager .bk2').click());
          }
          await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-act="menu"]').click());
          await settle(page);
          assert.deepEqual(await page.evaluate(audit), [], `${id} menu @${width} ${theme}`);
          await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-act="close"]').click());
        }
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  }
}
