// Rendered check: the World, Journal and Story tab switches draw as the mock's glass bar (not the plain bordered .seg box).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const TABS = [['world', '.world-tab .wseg'], ['journal', '.journal-tab .wseg'], ['story', '.story-tab .wseg']];

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > 8899) { reject(new Error('no free port in 8800-8899')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8800);
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
  for (const width of [390, 820]) {
    for (const [tab, sel] of TABS) {
      test(`${tab} tab switch at ${width} in ${theme}: glass bar, 22px radius, 13.5px/800 labels`, async (t) => {
        if (ctx.skip) return t.skip(ctx.skip);
        const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
        await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=${tab}`);
        await page.waitForSelector(`#hx-frame ${sel}`);
        const got = await page.evaluate((s) => {
          const bar = document.querySelector(s);
          const cs = getComputedStyle(bar);
          const btn = getComputedStyle(bar.querySelector('button'));
          return { radius: cs.borderTopLeftRadius, overflow: cs.overflow, bg: cs.backgroundColor, shadow: cs.boxShadow, blur: cs.backdropFilter, display: cs.display, size: btn.fontSize, weight: btn.fontWeight };
        }, sel);
        await page.close();
        assert.equal(got.radius, '22px');
        assert.equal(got.overflow, 'visible');
        assert.equal(got.display, 'flex');
        assert.notEqual(got.bg, 'rgba(0, 0, 0, 0)');
        assert.notEqual(got.shadow, 'none');
        assert.match(got.blur, /blur\(/);
        assert.equal(got.size, '13.5px');
        assert.equal(got.weight, '800');
      });
    }
  }
}
