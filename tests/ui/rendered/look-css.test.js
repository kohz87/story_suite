// Rendered check: Settings › Look's Text size in a real browser. 110% / 120% (the root's data-text) draws the suite's text larger while
// its frame keeps its width.
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

async function harness(width) {
  const page = await ctx.browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=${width}&tab=now`);
  await page.waitForSelector('.su-root .su-content', { state: 'attached' });
  await page.evaluate(() => document.fonts.ready);   // (a probe measured in the fallback font is not 1.2 times anything)
  // and the open animation (slide or fade + scale) has ended, so the frame is measured at rest
  await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity).length === 0);
  return page;
}

for (const width of [390, 1280]) {
  test(`Text size at ${width}: 110% and 120% draw the text 1.1 and 1.2 times larger; the frame fills the window; the tablet column stays 820 px on screen and the desktop card column grows with the text`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await harness(width);
    const measure = size => page.evaluate(size => {
      const root = document.querySelector('.su-root');
      if (size) root.setAttribute('data-text', size); else root.removeAttribute('data-text');
      const probe = document.createElement('span');
      probe.textContent = 'Probe';
      root.querySelector('.su-content').appendChild(probe);
      const got = { frame: root.getBoundingClientRect().width, card: root.querySelector('.su-card-slot').getBoundingClientRect().width, text: probe.getBoundingClientRect().height, zoom: getComputedStyle(root).zoom };
      probe.remove();
      return got;
    }, size);
    const normal = await measure(null);
    const at110 = await measure('110');
    const at120 = await measure('120');
    await page.close();
    assert.equal(normal.zoom, '1');
    assert.equal(at110.zoom, '1.1');
    assert.equal(at120.zoom, '1.2');
    assert.ok(Math.abs(at110.text / normal.text - 1.1) < 0.03, `110%: ${at110.text} vs ${normal.text}`);
    assert.ok(Math.abs(at120.text / normal.text - 1.2) < 0.03, `120%: ${at120.text} vs ${normal.text}`);
    assert.equal(normal.frame, width); // mock v7 Desktop: the root fills the window (UIFIX5)
    assert.ok(Math.abs(at110.frame - normal.frame) < 1, `110% frame ${at110.frame}`);
    assert.ok(Math.abs(at120.frame - normal.frame) < 1, `120% frame ${at120.frame}`);
    if (width === 1280) {
      // desktop layout A (ui/css/desk.css): the card's column is 360 px, zoomed with the text at 110% (the root is 1164 px of zoomed width, still desktop);
      // at 120% the root is 1067 px of zoomed width, under 1100: the tablet column, 820 px on screen less its zoomed 14.4 px edges
      assert.ok(Math.abs(normal.card - 360) <= 1, `card ${normal.card}`);
      assert.ok(Math.abs(at110.card - 396) <= 1, `110% card ${at110.card}`);
      assert.ok(Math.abs(at120.card - (820 - 24 * 1.2)) <= 1, `120% card ${at120.card}`);
      return;
    }
    assert.ok(Math.abs(normal.card - (Math.min(width, 820) - 24)) <= 1, `card ${normal.card}`);
    // the 12 px edges inside the column are zoomed with the text (13.2 and 14.4 px)
    assert.ok(Math.abs(at110.card - normal.card) <= 4, `110% card ${at110.card}`);
    assert.ok(Math.abs(at120.card - normal.card) <= 6, `120% card ${at120.card}`);
  });
}
