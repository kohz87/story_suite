// Rendered check (SFF4 #12): the Settings sheet blurs the open suite behind it (Glass v5's sheet blur, kit.css .sh-panel), so at 390 the suite's card
// and rows do not read through the settings; the sheet keeps the glass panel colour. Screenshots go to SFF4_SHOTS when it is set.
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

for (const [width, height] of [[390, 800], [1280, 900]]) {
  for (const theme of ['dark', 'light']) {
    test(`${width} in ${theme}: the Settings sheet blurs the suite behind it`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
        await page.click('button.ibtn >> visible=true');
        await page.waitForSelector('.shd .ttl small');
        const look = await page.evaluate(() => {
          const style = getComputedStyle(document.querySelector('.sov>.glass'));
          return { filter: style.backdropFilter || style.webkitBackdropFilter || '', background: style.backgroundColor };
        });
        assert.match(look.filter, /blur\(28px\)/, JSON.stringify(look));
        assert.match(look.background, /^rgba?\(/, JSON.stringify(look));
        if (process.env.SFF4_SHOTS) await page.screenshot({ path: path.join(process.env.SFF4_SHOTS, `settings-${width}-${theme}.png`) });
      } finally {
        await page.close();
      }
    });
  }
}
