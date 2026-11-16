// Rendered check: the Story-only character card at 390 matches the mock (statuses, height, settings button font).
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

/** Runs in the page: reads the visible status names, the card height and the settings button font. */
function read() {
  const card = document.querySelector('#hx-frame [data-card="character"]');
  const btn = card.querySelector('.ctop .ibtn');
  const s = getComputedStyle(btn);
  return {
    statuses: [...card.querySelectorAll('.fx2 .f')].filter((f) => f.getBoundingClientRect().height > 0).map((f) => f.textContent),
    height: card.getBoundingClientRect().height,
    font: `${s.fontSize} ${s.fontFamily}`,
  };
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
  if (ctx?.server) await new Promise((done) => ctx.server.close(done));
});

for (const theme of ['dark', 'light']) {
  test(`Story-only card at 390 shows Bleeding and Winded, no Shadow Step, 213.3 px tall in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&variant=rpgOff&tab=now`);
      await page.waitForSelector('#hx-frame [data-card="character"]');
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const s = await page.evaluate(read);
      assert.ok(s.statuses.some((x) => /Bleeding/.test(x)), s.statuses.join('|'));
      assert.ok(s.statuses.some((x) => /Winded/.test(x)), s.statuses.join('|'));
      assert.ok(!s.statuses.some((x) => /Shadow Step/.test(x)));
      assert.ok(Math.abs(s.height - 213.3) <= 0.5, `height ${s.height}`);
      assert.match(s.font, /^13\.3333px "?Arial"?/);
    } finally { await page.close(); }
  });
}
