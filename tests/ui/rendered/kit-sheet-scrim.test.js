// Rendered check: the shared kit sheet (Journal quest editor) draws the mock's scrim (.45, no blur) and 460px centred panel.
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
    test(`kit sheet at ${width} in ${theme}: scrim rgba(6,8,16,.45) with no blur, panel 460px wide when centred`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=journal`);
      await page.waitForSelector('#hx-frame .qedit');
      await page.evaluate(() => document.fonts.ready);
      await page.click('#hx-frame .qedit');
      await page.waitForSelector('#hx-frame .sh-ov .sh-panel');
      const got = await page.evaluate(() => {
        const ov = document.querySelector('#hx-frame .sh-ov');
        const cs = getComputedStyle(ov);
        const p = ov.querySelector('.sh-panel').getBoundingClientRect();
        return { bg: cs.backgroundColor, blur: cs.backdropFilter, panelW: p.width, panelX: p.x - ov.getBoundingClientRect().x, ovW: ov.getBoundingClientRect().width };
      });
      await page.close();
      assert.equal(got.bg, 'rgba(6, 8, 16, 0.45)');
      assert.equal(got.blur, 'none');
      if (width >= 601) { assert.equal(got.panelW, 460); assert.equal(got.panelX, (got.ovW - 460) / 2); }
      else assert.equal(got.panelW, got.ovW, 'the bottom sheet spans the width on a phone');
    });
  }
}
