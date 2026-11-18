// Rendered check: mock v7 tablet column. The suite root fills the window at every width (the sky edge to edge), and under the desktop width (1100 px,
// tests/ui/rendered/desktop-layout-a.test.js) the card, the tab strip and the page keep one 820 px column in the middle (12 px edges inside it);
// at 820 px and under the column is the window less the 12 px edges. Here now and the desktop columns are not drawn there.
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

/** Runs in the page: the root's box, and the card's, the strip's and the page's first block's left edge and width. */
function measure() {
  const box = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width) }; };
  return {
    frame: box('#hx-frame'), root: box('.su-root'), card: box('.su-card-slot'), strip: box('.su-strip'), panel: box('.su-panel > *'),
    here: getComputedStyle(document.querySelector('.su-here-slot')).display, nowHere: Boolean(document.querySelector('.now-tab [data-card="here"]')),
  };
}

for (const width of [390, 820, 900, 1099]) {
  for (const theme of ['dark', 'light']) {
    test(`desktop column at ${width} in ${theme}: the root fills the window, the content keeps the 820 px column`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=now`);
        await page.waitForSelector('#hx-frame .su-card-slot .ctop');
        // (the open animation, slide or fade + scale, has ended: boxes are measured at rest)
        await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity).length === 0);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const m = await page.evaluate(measure);
        assert.equal(m.root.w, m.frame.w, 'the suite root is as wide as the window');
        const column = Math.min(width, 820) - 24;
        const left = m.frame.x + Math.max(12, (width - 820) / 2 + 12);
        assert.ok(Math.abs(m.card.w - column) <= 1, `card ${m.card.w} vs column ${column}`);
        assert.ok(Math.abs(m.card.x - left) <= 1, `card left ${m.card.x} vs ${left}`);
        assert.ok(Math.abs(m.panel.w - column) <= 1, `page ${m.panel.w} vs column ${column}`);
        assert.equal(m.here, 'none', 'Here now is a desktop column only');
        assert.equal(m.nowHere, true, 'Now keeps its Here card');
        if (width >= 600) assert.ok(Math.abs(m.strip.x - left) <= 1 && Math.abs(m.strip.w - column) <= 1, `strip ${JSON.stringify(m.strip)}`);
      } finally { await page.close(); }
    });
  }
}
