// Rendered check: the tab strip (tablet and up) keeps the mock's 1px transparent border, pill radius and tab offsets at 820 and 1280.
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
  for (const width of [820, 1280]) {
    test(`tab strip at ${width} in ${theme}: 1px transparent border, 999px radius, the selected tab 1px in and 3px down`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
      await page.waitForSelector('#hx-frame .su-strip .su-tab');
      await page.evaluate(() => document.fonts.ready);
      const got = await page.evaluate(() => {
        const strip = document.querySelector('#hx-frame .su-strip');
        const tabs = [...strip.querySelectorAll('.su-tab')];
        const s = strip.getBoundingClientRect();
        const cs = getComputedStyle(strip);
        const on = tabs.find(x => x.getAttribute('aria-selected') === 'true');
        const off = tabs.find(x => x !== on);
        const o = on.getBoundingClientRect();
        return { border: [cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor], radius: cs.borderTopLeftRadius, blur: cs.backdropFilter, h: s.height,
          dx: o.x - s.x, dy: o.y - s.y, onBorder: getComputedStyle(on).borderTopWidth, offBorder: getComputedStyle(off).borderTopWidth, tabH: o.height };
      });
      await page.close();
      assert.deepEqual(got.border, ['1px', 'solid', 'rgba(0, 0, 0, 0)']);
      assert.equal(got.radius, '999px');
      assert.match(got.blur, /blur\(16px\)/);
      assert.equal(got.h, 43, 'the strip is 43px: 37px tabs (the mock), 2px padding, 1px border');
      assert.equal(got.dx, 1);
      assert.equal(got.dy, 3);
      assert.equal(got.onBorder, '1px');
      assert.equal(got.offBorder, '0px', 'only the selected tab has a border');
      assert.ok(got.tabH >= 37, 'tab pills keep the mock 37px height (the 820px column is kept at 1280)');
    });
  }
}
