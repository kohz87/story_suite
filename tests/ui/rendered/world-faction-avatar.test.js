// Rendered check: the World Factions member avatars draw white 12px letters on the people disc colour, as the mock's global .avs .a rule.
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
    test(`World Factions avatar at ${width} in ${theme}: 12px white letters on the people disc colour`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=world`);
      await page.waitForSelector('#hx-frame .wseg button');
      await page.evaluate(() => [...document.querySelectorAll('#hx-frame .wseg button')].find(b => b.textContent.trim().startsWith('Factions')).click());
      await page.waitForSelector('#hx-frame .fac .avs .a');
      const got = await page.evaluate(() => {
        const a = document.querySelector('#hx-frame .fac .avs .a');
        const cs = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return { size: cs.fontSize, weight: cs.fontWeight, color: cs.color, bg: cs.backgroundColor, w: r.width, h: r.height };
      });
      await page.close();
      assert.equal(got.size, '12px');
      assert.equal(got.weight, '800');
      assert.equal(got.color, 'rgb(255, 255, 255)');
      assert.equal(got.bg, theme === 'dark' ? 'rgb(58, 60, 82)' : 'rgb(74, 77, 104)');
      assert.deepEqual([got.w, got.h], [24, 24]);
    });
  }
}
