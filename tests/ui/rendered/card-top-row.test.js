// Rendered check: pins the mock's card top row values (icon gap, icon positions, settings button font and size) at phone and tablet.
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

function measure() {
  const cs = sel => getComputedStyle(document.querySelector(sel));
  const box = sel => document.querySelector(sel).getBoundingClientRect();
  return {
    gapOuter: cs('.ctop .meta > span').gap,
    gapText: cs('.ctop .tm').gap,
    iconToText: +(box('.ctop .tm').left - box('.ctop .meta svg').right).toFixed(1),
    svg: box('.ctop .meta svg').width,
    ibtn: { font: cs('.ctop .ibtn').font, w: box('.ctop .ibtn').width, h: box('.ctop .ibtn').height },
  };
}

for (const width of [390, 820]) {
  for (const theme of ['dark', 'light']) {
    test(`card top row matches the mock at ${width}px, ${theme}`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=now`);
        await page.waitForSelector('#hx-frame .su-host');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.ctop .meta > span')).gap === '5px');
        const m = await page.evaluate(measure);
        assert.equal(m.gapOuter, '5px');
        assert.equal(m.gapText, '5px');
        assert.equal(m.iconToText, 5);
        assert.equal(m.svg, 15);
        assert.equal(m.ibtn.font, '13.3333px Arial');
        assert.equal(m.ibtn.w, 44);
        assert.equal(m.ibtn.h, 44);
      } finally { await page.close(); }
    });
  }
}
