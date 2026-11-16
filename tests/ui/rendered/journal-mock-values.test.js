// Rendered check: the Journal tab keeps the approved mock's fixed values (links, due chips, calendar numbers, lapse line, quest editor close).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > 8999) { reject(new Error('no free port in 8900-8999')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8900);
  });
}

let ctx = null;
test.before(async () => {
  try {
    const { chromium } = await import('playwright');
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

/** Reads computed values of the first match of each selector inside the harness frame. */
const read = (page, sels) => page.evaluate(map => Object.fromEntries(Object.entries(map).map(([k, s]) => {
  const e = document.querySelector(`#hx-frame ${s}`);
  if (!e) return [k, null];
  const c = getComputedStyle(e); const r = e.getBoundingClientRect();
  return [k, { h: Math.round(r.height * 10) / 10, pad: c.paddingLeft, size: c.fontSize, weight: c.fontWeight, bg: c.backgroundColor }];
})), sels);

for (const theme of ['dark', 'light']) {
  for (const width of [390, 820]) {
    test(`journal matches the mock at ${width} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1100 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=journal`);
        await page.waitForSelector('#hx-frame .journal-tab .qkv');
        const q = await read(page, { lk: '.journal-tab .lk', fstar: '.fstar', soon: '.qkv .due.soon', late: '.qkv .due.late', lapse: '.lapse' });
        assert.equal(q.lk.h, 19.5, 'link is a text line, not a 44 px box');
        assert.equal(q.lk.pad, '0px');
        assert.equal(q.fstar.pad, '0px');
        assert.equal(q.soon.bg, 'rgba(242, 180, 90, 0.16)');
        assert.equal(q.late.bg, 'rgba(229, 72, 77, 0.14)');
        assert.equal(q.lapse?.size ?? '12px', '12px');
        await page.evaluate(() => document.querySelector('#hx-frame [data-value="cal"]').click());
        await page.waitForSelector('#hx-frame .cd b');
        assert.equal((await read(page, { n: '.cd b' })).n.size, '15px');
        await page.evaluate(() => document.querySelector('#hx-frame [data-value="quests"]')?.click());
        await page.waitForSelector('#hx-frame .qedit');
        await page.evaluate(() => document.querySelector('#hx-frame .qedit').click());
        await page.waitForSelector('.qeh .x');
        const x = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.qeh .x')); return [c.fontSize, c.fontWeight, c.borderRadius]; });
        assert.deepEqual(x, ['16px', '800', '10px']);
      } finally { await page.close(); }
    });
  }
}
