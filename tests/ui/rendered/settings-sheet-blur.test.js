// Rendered check (SFF4 #12): the Settings sheet is the mock's glass over the sky backdrop, never over the suite: at 390 and 1280, dark and light, and with
// SillyTavern's No Blur Effect on (body.no-blur unsets every backdrop-filter, as the owner's SillyTavern has it), the sheet's pixels are the same whether
// the suite behind it shows its card and rows or nothing. Screenshots go to SFF4_SHOTS when it is set.
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
    for (const noBlur of [true, false]) {
      test(`${width} in ${theme}${noBlur ? ', No Blur Effect on' : ''}: nothing of the suite reads through the Settings sheet`, async (t) => {
        if (ctx.skip) return t.skip(ctx.skip);
        const page = await ctx.browser.newPage({ viewport: { width, height } });
        await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
        try {
          await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
          await page.click('button.ibtn >> visible=true');
          await page.waitForSelector('.shd .ttl small');
          if (noBlur) await page.evaluate(() => { document.body.classList.add('no-blur'); const s = document.createElement('style'); s.textContent = 'body.no-blur * { backdrop-filter: unset !important; -webkit-backdrop-filter: unset !important; }'; document.head.append(s); });
          await page.waitForTimeout(300);
          // The inside of the sheet (its rounded corners and 1px glass border are left out: the backdrop shows there by design).
          const box = await page.locator('.sov>.glass').boundingBox();
          const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight, sx: scrollX, sy: scrollY }));
          const top = box.y + 24, bottom = Math.min(box.y + box.height, view.h) - 24;
          const clip = { x: box.x + 24 + view.sx, y: top + view.sy, width: Math.min(box.width, view.w - box.x) - 48, height: bottom - top };
          assert.ok(clip.height > 200 && clip.width > 200, JSON.stringify({ box, view }));
          const shoot = () => page.screenshot({ clip });
          const withSuite = await shoot();
          if (process.env.SFF4_SHOTS) fs.writeFileSync(path.join(process.env.SFF4_SHOTS, `sheet-${width}-${theme}${noBlur ? '-noblur' : ''}.png`), withSuite);
          // Everything of the suite but the sheet is hidden: the sheet must look the same.
          await page.evaluate(() => { for (const el of document.querySelectorAll('.su-root > *:not(.sov)')) el.style.visibility = 'hidden'; });
          await page.waitForTimeout(200);
          const withoutSuite = await shoot();
          if (process.env.SFF4_SHOTS) fs.writeFileSync(path.join(process.env.SFF4_SHOTS, `sheet-${width}-${theme}${noBlur ? '-noblur' : ''}-alone.png`), withoutSuite);
          assert.ok(Buffer.from(withSuite).equals(Buffer.from(withoutSuite)), 'the suite behind shows through the sheet');
        } finally {
          await page.close();
        }
      });
    }
  }
}
