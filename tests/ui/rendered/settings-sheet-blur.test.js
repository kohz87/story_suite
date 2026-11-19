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
          if (width < 600) assert.ok(Buffer.from(withSuite).equals(Buffer.from(withoutSuite)), 'the suite behind shows through the sheet');
          else {
            // The floating window is a clipped, rounded, composited layer: its text edges anti-alias by a few levels differently once the layers behind are hidden.
            // Anything of the suite showing through is far larger than that: count the pixels that differ by more than 16 levels of 255.
            const off = await page.evaluate(async ([a, b]) => {
              const load = async s => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
              const [x, y] = [await load(a), await load(b)];
              let n = 0;
              for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 16) n++;
              return n;
            }, [Buffer.from(withSuite).toString('base64'), Buffer.from(withoutSuite).toString('base64')]);
            assert.equal(off, 0, 'the suite behind shows through the sheet');
          }
        } finally {
          await page.close();
        }
      });
    }
  }
}

test('Panel background Off: the sheet lies on the flat surface, not on the sky; On: on the sky (390, dark and light)', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  for (const theme of ['dark', 'light']) {
    const page = await ctx.browser.newPage({ viewport: { width: 390, height: 800 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&tab=now`);
      await page.click('button.ibtn >> visible=true');
      await page.waitForSelector('.shd .ttl small');
      const under = value => page.evaluate(v => { const root = document.querySelector('.su-root'); root.setAttribute('data-panelbg', v); const bg = getComputedStyle(document.querySelector('.sov>.glass')); return { image: bg.backgroundImage, color: bg.backgroundColor, flat: getComputedStyle(root).backgroundColor }; }, value);
      const off = await under('off');
      assert.doesNotMatch(off.image, /135deg/, `${theme} off: ${JSON.stringify(off)}`);
      assert.equal(off.color, off.flat, `${theme} off: the sheet's base is the suite's flat colour`);
      const on = await under('on');
      assert.match(on.image, /135deg/, `${theme} on: ${JSON.stringify(on)}`);
    } finally {
      await page.close();
    }
  }
});
