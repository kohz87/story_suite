// Rendered check: Settings rows whose tag chip wraps onto its own line are as tall as in the mock (chip line 18px), so People and Director keep the mock's row positions at 390.
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

for (const theme of ['dark', 'light']) {
  test(`settings People and Director at 390 in ${theme}: a tag chip that wraps adds the chip's 18px, not a font strut (no 1px creep per row)`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 390, height: 1400 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&tab=now`);
      await page.click('button.ibtn >> visible=true');
      await page.waitForSelector('.phonelist .slist button');
      await page.evaluate(() => document.fonts.ready);
      const measure = async (sec) => {
        await page.click(`.phonelist button[data-sec="${sec}"]`);
        await page.waitForSelector('.msubs .srow');
        const got = await page.evaluate(() => [...document.querySelectorAll('.srow b.tagd')].map(b => {
          const chip = b.querySelector('.tg2').getBoundingClientRect();
          const text = b.querySelector('.ln').getBoundingClientRect();
          return { wrapped: chip.top >= text.bottom - 1, h: b.getBoundingClientRect().height, lines: Math.round(text.height / 19), lh: getComputedStyle(b.querySelector('.ln')).lineHeight };
        }));
        await page.click('.sback >> visible=true');
        return got;
      };
      for (const sec of ['people', 'director']) {
        const rows = await measure(sec);
        assert.ok(rows.length > 0, `${sec} has tagged rows`);
        const wrapped = rows.filter(r => r.wrapped);
        assert.ok(wrapped.length > 0, `${sec} has a tagged row whose chip wraps`);
        for (const r of wrapped) assert.equal(r.h, r.lines * 19 + 18, 'text lines at 19px plus the 18px chip line');
      }
    } finally { await page.close(); }
  });
}
