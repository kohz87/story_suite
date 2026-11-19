// Rendered check: the dossier detail pane (.dpane) keeps the mock's 14px 16px padding and 12px gap, so the spoiler switch sits where it does in the mock.
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
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
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

for (const theme of ['dark', 'light']) {
  for (const width of [390, 820]) {
    test(`dossier Right now part at ${width} in ${theme}: 16px padding, 12px gap, the spoiler switch 24px under the facts and full width`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=people`);
      await page.waitForSelector('#hx-frame [data-person-id="temiwa"]');
      await page.evaluate(() => document.fonts.ready);
      await page.click('#hx-frame [data-person-id="temiwa"]');
      await page.waitForSelector('#hx-frame .dossier .dcard[data-page="now"]');
      await page.click('#hx-frame .dcard[data-page="now"]');
      await page.waitForSelector('#hx-frame .dpane .spo .sw');
      const got = await page.evaluate(() => {
        const body = document.querySelector('#hx-frame .dpane .db');
        const cs = getComputedStyle(body);
        const b = body.getBoundingClientRect();
        const row = body.querySelector('.spo').getBoundingClientRect();
        const facts = [...body.querySelectorAll('.dpage-now > .dpsec')].at(-1).getBoundingClientRect();
        const sw = body.querySelector('.spo .sw').getBoundingClientRect();
        return { pad: cs.padding, gap: cs.rowGap, above: Math.round(row.top - facts.bottom), h: Math.round(row.height), inset: [Math.round(row.left - b.left), Math.round(b.right - row.right)], inside: sw.right <= row.right && sw.left >= row.left };
      });
      await page.close();
      assert.equal(got.pad, '16px');
      assert.equal(got.gap, '12px');
      assert.equal(got.above, 24, 'mock: 24 px between Thinking and the Scene spoilers switch');
      assert.ok(got.h >= 56, `the switch row is at least 56 px (${got.h})`);
      assert.deepEqual(got.inset, [17, 17], 'full width inside the body (16 px padding and its 1 px border)');
      assert.equal(got.inside, true);
    });
  }
}
