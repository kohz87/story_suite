// Rendered check: at 601px and wider the Settings overlay covers the whole window (18px in, the mock's rule), not the centred 820px suite column; at 390 it is unchanged.
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

// Owner Q3: the mock wins. The overlay's box is measured against the window, with the open suite behind it.
for (const [width, height] of [[390, 800], [1143, 800], [1280, 900], [1920, 1080]]) {
  for (const theme of ['dark', 'light']) {
    test(`${width} in ${theme}: the Settings overlay ${width > 600 ? 'covers the window, 18px in' : 'fills the phone panel'}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
        await page.click('button.ibtn >> visible=true');
        await page.waitForSelector('.shd .ttl small');
        const box = await page.evaluate(() => {
          // The harness frame offsets the fixed layer, so the box is measured from the layer (the window in SillyTavern).
          const r = document.querySelector('.sov').getBoundingClientRect();
          const w = document.querySelector('.su-layer').getBoundingClientRect();
          return { left: Math.round(r.left - w.left), top: Math.round(r.top - w.top), width: Math.round(r.width), height: Math.round(r.height) };
        });
        const inset = width > 600 ? 18 : 0;
        assert.deepEqual(box, { left: inset, top: inset, width: width - 2 * inset, height: height - 2 * inset }, JSON.stringify(box));
      } finally { await page.close(); }
    });
  }
}
