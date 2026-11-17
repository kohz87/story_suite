// Rendered check: desktop chrome: tab pills 37 px, the card's ‹ Chat pill and ⚙ (mock v7 card style), and the Now sublines (18 px per line, as in the mock).
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
  const top = sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width); return e ? e.getBoundingClientRect().top : null; };
  const sub = [...document.querySelectorAll('small')].find(x => x.textContent.startsWith('Goldwane 12') && x.getBoundingClientRect().width);
  const more = top('.more-btn');
  return {
    tabH: h('.su-tab'),
    bk: `${bk.padding} | ${bk.borderRadius} | ${bk.fontWeight}`,
    bkH: h('.ctop .bk'),
    ibtn: `${ib.padding} | ${ib.fontWeight}`,
    sub: h('.rnr small') ?? h('.cr small'),
    // distance from the first Needs-you subline down to the Show all button: every row in between counts
    pitch: sub && more != null ? more - sub.getBoundingClientRect().top : null,
  };
}

// pitch: the mock's value at that width (RECBLK render of suite.html); the built page sits 3-4 px short of it from older sub-pixel rounding
const MOCK_PITCH = { 390: 1739.8, 1280: 781 };
for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`desktop chrome at ${width} in ${theme}: tab pills, card buttons and Now sublines`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=now`);
        await page.waitForSelector('#hx-frame .ctop .bk');
        await page.waitForSelector('#hx-frame .rnr small, #hx-frame .cr small');
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const m = await page.evaluate(measure);
        assert.equal(m.bk, '6px 12px | 999px | 800');
        assert.equal(m.bkH, width <= 600 ? 44 : 32);
        assert.equal(m.ibtn, '1px 6px | 400');
        assert.equal(m.sub, 18); // the mock's .rnr small is a flex item on an 18 px line
        if (MOCK_PITCH[width]) assert.ok(Math.abs(m.pitch - MOCK_PITCH[width]) <= 4, `rows drift from the mock: ${m.pitch} vs ${MOCK_PITCH[width]}`);
        if (width >= 600) assert.equal(m.tabH, 37);
        else assert.equal(m.tabH, null);
      } finally { await page.close(); }
    });
  }
}
