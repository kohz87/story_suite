// Rendered check: at 820 px the World trip card is 520 px wide, left aligned under the map, with the legend below it (mock values).
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

async function measure(theme, width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=world`);
    await page.waitForSelector('#hx-frame .su-host .tripc.side');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.tripc.side')).maxWidth === '520px');
    return await page.evaluate(() => {
      const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { card: r('.tripc.side'), map: r('.mapbox'), legend: r('.legend2') };
    });
  } finally { await page.close(); }
}

for (const theme of ['dark', 'light']) {
  test(`trip card is 520 px wide and left aligned at 820 in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const m = await measure(theme, 820);
    assert.equal(m.card.w, 520);
    assert.equal(m.card.x, m.map.x, 'left edge matches the map');
    assert.ok(m.card.y > m.map.y + m.map.h, 'card sits under the map');
    assert.ok(m.legend.y >= m.card.y + m.card.h, 'legend below the card');
  });

  test(`trip card still fills the width at 390 in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const m = await measure(theme, 390);
    assert.equal(m.card.w, m.map.w);
  });
}
