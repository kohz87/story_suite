// Rendered check: desktop chrome: tab pills 37 px, the card's ‹ Chat pill and ⚙ (mock v7 card style), and the Needs you sublines (18 px per line, as in the mock).
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

/** Runs in the page: the computed values this job fixed. */
function measure() {
  const cs = sel => { const e = document.querySelector(sel); return e && e.getBoundingClientRect().width ? getComputedStyle(e) : null; };
  const h = sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const bk = cs('.ctop .bk'), ib = cs('.ctop .ibtn');
  return {
    tabH: h('.su-tab'),
    bk: `${bk.padding} | ${bk.borderRadius} | ${bk.fontWeight}`,
    bkH: h('.ctop .bk'),
    ibtn: `${ib.padding} | ${ib.fontWeight}`,
    sub: h('.rnr small'),
  };
}

for (const width of [390, 700, 860, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`desktop chrome at ${width} in ${theme}: tab pills, card buttons and Needs you sublines`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=party`);
        await page.waitForSelector('#hx-frame .ctop .bk');
        await page.waitForSelector('#hx-frame .su-needs-slot .rnr small');
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const m = await page.evaluate(measure);
        assert.equal(m.bk, '6px 12px | 999px | 800');
        const root = width > 820 ? Math.min(1280, width - 48) : width; // the suite is a floating window on a desktop window: 24 px margin each side, 1280 px at most
        assert.equal(m.bkH, root <= 900 ? 44 : 32);   // the root: 44 px up to 900 wide, the card's 32 px pill above
        assert.equal(m.ibtn, '1px 6px | 400');
        assert.equal(m.sub, 18); // the mock's .rnr small is a flex item on an 18 px line
        if (width >= 600) assert.equal(m.tabH, 37);
        else assert.equal(m.tabH, null);
      } finally { await page.close(); }
    });
  }
}
