// Rendered check: Settings › Help in the harness at phone (390) and desktop (1280) width, dark and light: the page is there, a question opens, nothing runs past the
// window, every question button is a 44 px tap target, and a search narrows the list. Skips without a browser (not in CI).
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
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })); });
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

for (const [width, height] of [[390, 844], [1280, 900]]) {
  for (const theme of ['dark', 'light']) {
    test(`${width} in ${theme}: the Help page opens a question, fits the window and searches`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
        await page.click('button.ibtn >> visible=true');
        await page.waitForSelector('.shd .ttl small');
        await page.click('button[data-sec="help"] >> visible=true');
        await page.waitForSelector('.helplist');
        await page.click('.hq-t >> nth=1');
        const m = await page.evaluate(() => ({
          wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          over: [...document.querySelectorAll('.helplist *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
          tap: Math.min(...[...document.querySelectorAll('.hq-t')].map(e => e.getBoundingClientRect().height)),
          open: document.querySelectorAll('.hq-a').length,
        }));
        assert.equal(m.wide, 0);
        assert.equal(m.over, 0);
        assert.ok(m.tap >= 44, `question buttons are ${m.tap}px tall`);
        assert.equal(m.open, 1);
        const all = await page.locator('.hq').count();
        await page.fill('.hsrch', 'portrait');
        const found = await page.locator('.hq').count();
        assert.ok(found >= 1 && found < all, `a search narrows ${all} to ${found}`);
        assert.ok(await page.locator('.hq-a').count() >= 1, 'a search opens what it finds');
      } finally { await page.close(); }
    });
  }
}
