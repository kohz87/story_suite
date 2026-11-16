// Rendered check: the Party tab keeps the mock's fixed values (member card padding, sheet and column gaps, stance line and colour).
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
    const tryPort = port => {
      if (port > 8999) { reject(new Error('no free port in 8900-8999')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8900);
  });
}

/** Runs in the page: reads the values the mock fixes for the Party tab. */
function measure() {
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const css = (s, p) => getComputedStyle(q(s))[p];
  const stance = q('.sk.stance');
  return {
    memberPad: css('[data-card="members"]', 'padding'),
    sheetGap: css('.psheet', 'rowGap'),
    stanceLine: stance.querySelector('small').textContent,
    stanceColor: getComputedStyle(stance.querySelector('.rk')).color,
    lowerGap: css('.lower', 'columnGap'),
    lowerCols: getComputedStyle(q('.lower')).gridTemplateColumns.split(' ').length,
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
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

for (const theme of ['dark', 'light']) {
  for (const [width, height, cols] of [[390, 844, 1], [820, 1000, 2]]) {
    test(`Party fixed values at ${width} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=party`);
        await page.waitForSelector('#hx-frame .su-host');
        await page.evaluate(() => document.querySelector('#hx-frame [data-member="brann"]').click());
        await page.waitForSelector('#hx-frame .sk.stance');
        const got = await page.evaluate(measure);
        assert.equal(got.memberPad, '10px 12px');
        assert.equal(got.sheetGap, '12px');
        assert.equal(got.stanceLine, 'Stance · defence · 1 Stamina each exchange');
        assert.equal(got.stanceColor, 'rgb(240, 184, 74)');
        assert.equal(got.lowerGap, '12px');
        assert.equal(got.lowerCols, cols);
      } finally { await page.close(); }
    });
  }
}
