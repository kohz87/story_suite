// Rendered check: the tablet layout on every width. The suite root is the floating window (the whole window up to 820 px, 24 px margins and 1280 x 940 at most
// above it) and the card, the tab strip and the page fill it between 12 px edges: no 820 px column, no side column, no Now tab.
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
  const box = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    frame: box('#hx-frame'), root: box('.su-root'), card: box('.su-card-slot'), strip: box('.su-strip'), panel: box('.su-panel > *'),
    side: Boolean(document.querySelector('.su-side, .su-here-slot, .now-tab')),
  };
}

for (const width of [390, 820, 900, 1099, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`desktop width at ${width} in ${theme}: the root is the floating window (or the whole window up to 820 px), the card, the strip and the page fill it (no 820 px column, no side column)`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=party`);
        await page.waitForSelector('#hx-frame .su-card-slot .ctop');
        // (the open animation, slide or fade + scale, has ended: boxes are measured at rest)
        await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity).length === 0);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const m = await page.evaluate(measure);
        const rootW = width > 820 ? Math.min(1280, width - 48) : width;
        assert.equal(m.root.w, rootW, width > 820 ? 'the suite root is the floating window: 24 px margin each side' : 'the suite root fills the window up to 820 px');
        if (width > 820) assert.ok(Math.abs(m.root.x - (m.frame.x + (width - rootW) / 2)) <= 1 && Math.abs(m.root.h - Math.min(940, 900 - 48)) <= 1, `centred ${JSON.stringify(m.root)}`);
        const column = rootW - 24;   // the 12 px edges
        assert.ok(Math.abs(m.card.w - column) <= 1, `card ${m.card.w} vs column ${column}`);
        assert.ok(Math.abs(m.card.x - (m.root.x + 12)) <= 1, `card left ${m.card.x}`);
        assert.ok(Math.abs(m.panel.w - column) <= 1, `page ${m.panel.w} vs column ${column}`);
        assert.equal(m.side, false, 'no side column and no Now tab');
        if (width >= 600) assert.ok(Math.abs(m.strip.x - (m.root.x + 12)) <= 1 && Math.abs(m.strip.w - column) <= 1, `strip ${JSON.stringify(m.strip)}`);
      } finally { await page.close(); }
    });
  }
}
