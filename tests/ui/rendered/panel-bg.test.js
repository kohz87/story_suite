// Rendered check: Settings › Look › Panel background: Off leaves no backdrop layer and a flat colour from the theme; On brings the sky picture back; the switch applies at once.
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
    ctx = { browser, ...(await serve()) };
  } catch (err) {
    if (process.env.CI === 'true') throw err;
    ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
  }
});
test.after(async () => {
  if (ctx?.browser) await ctx.browser.close();
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

/** Runs in the page: what the suite's backdrop and root paint now. */
function paint() {
  const root = document.querySelector('.su-root');
  const back = root.querySelector('.su-back');
  return { attr: root.getAttribute('data-panelbg'), backDisplay: getComputedStyle(back).display, backImage: getComputedStyle(back).backgroundImage, rootBg: getComputedStyle(root).backgroundColor, rootImage: getComputedStyle(root).backgroundImage };
}

for (const [width, theme] of [[1280, 'dark'], [390, 'light'], [1280, 'light'], [390, 'dark']]) {
  test(`panel background at ${width} in ${theme}: Off is flat with no backdrop layer, On is the picture, the switch applies at once`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=now`);
      await page.waitForSelector('#hx-frame .ctop .bk');
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const off = await page.evaluate(paint);
      assert.equal(off.attr, 'off');
      assert.equal(off.backDisplay, 'none');
      assert.equal(off.rootImage, 'none', 'no gradient on the root');
      assert.equal(off.rootBg, theme === 'dark' ? 'rgb(25, 26, 43)' : 'rgb(232, 233, 241)');
      await page.evaluate(() => globalThis.storySuiteHarness.suite().settings());
      await page.click(width <= 700 ? '.phonelist button[data-sec="look"]' : '.si3[data-sec="look"]');
      await page.click('[data-key="look.panelBg"] .sw');
      const on = await page.evaluate(paint);
      assert.equal(on.attr, 'on');
      assert.notEqual(on.backDisplay, 'none');
      assert.match(on.backImage, /gradient/);
      assert.match(on.rootImage, /gradient/);
      await page.click('[data-key="look.panelBg"] .sw');
      assert.equal((await page.evaluate(paint)).backDisplay, 'none');
    } finally { await page.close(); }
  });
}
