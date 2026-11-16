// Rendered check: at 1280 the suite stays the 820px column, so Settings rows, segmented buttons and header buttons keep 44px touch targets.
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

// The suite is the 820px tablet column at 1280 (decision 1), so the mock's "container <= 900px" rule keeps every target at 44px there.
for (const theme of ['dark', 'light']) {
  test(`1280 desktop in ${theme}: Settings nav rows, segmented buttons and header buttons keep 44px touch targets`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=1280&tab=now`);
      await page.click('button.ibtn >> visible=true');
      await page.waitForSelector('.shd .ttl small');
      await page.click('.si3[data-sec=look]');
      await page.waitForSelector('.sseg2 button');
      const got = await page.evaluate(() => {
        const h = s => Math.round(document.querySelector(s).getBoundingClientRect().height);
        const col = document.querySelector('.sov, .shd').closest('.sov, .shd').getBoundingClientRect().width;
        return { nav: h('.snav .si3'), seg: h('.sseg2 button'), close: h('.shd .x'), col };
      });
      assert.ok(got.col <= 900, `the settings overlay is the tablet column, not the full 1280px (${got.col})`);
      assert.ok(got.nav >= 44 && got.seg >= 44 && got.close >= 44, JSON.stringify(got));
    } finally { await page.close(); }
  });
}
