// Rendered check: the Journal calendar keeps the mock's row stride, day-pane height and Coming up offsets at 820 (the mock's .pre cells make the first two week rows 54 px).
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
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
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

for (const theme of ['dark', 'light']) {
  test(`journal calendar rows, day pane and Coming up match the mock at 820 in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1100 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=820&tab=journal`);
      await page.waitForSelector('#hx-frame .journal-tab .qkv');
      await page.evaluate(() => document.querySelector('#hx-frame [data-value="cal"]').click());
      await page.waitForSelector('#hx-frame .cd.pre');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#hx-frame .cd.pre')).paddingTop === '12px');
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const f = document.querySelector('#hx-frame');
        const top = f.querySelector('.calcard').getBoundingClientRect().y;
        const y = e => Math.round((e.getBoundingClientRect().y - top) * 10) / 10;
        const card = [...f.querySelectorAll('.card')].find(c => /Coming up/.test(c.textContent) && !c.querySelector('.cgrid'));
        return {
          rows: [...new Set([...f.querySelectorAll('.cd')].map(y))],
          preH: f.querySelector('.cd.pre').getBoundingClientRect().height,
          preB: getComputedStyle(f.querySelector('.cd.pre b')).fontSize,
          calcardH: f.querySelector('.calcard').getBoundingClientRect().height,
          dwrapH: f.querySelector('.dwrap').getBoundingClientRect().height,
          comingY: y(card),
          ugrp: [...f.querySelectorAll('.ugrp')].map(y),
        };
      });
      assert.deepEqual(m.rows, [143, 199, 255, 301, 347], 'week rows: 56 px stride for the first two, then 46');
      assert.equal(m.preH, 54);
      assert.equal(m.preB, '15px');
      assert.equal(m.calcardH, 432);
      assert.equal(m.dwrapH, 348);
      assert.equal(m.comingY, 444, 'Coming up card sits where the mock puts it');
      assert.deepEqual(m.ugrp, [501, 599, 697, 861]);
    } finally { await page.close(); }
  });
}
