// Rendered check: the Template page (Settings > Tools > Developer switch) goes through mount.js, keeps the switch off the host's settings, survives close and reopen, and lays the sample out like a real activity tab.
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

async function openTools(page, width) {
  await page.click('button.ibtn >> visible=true');
  await page.waitForSelector('.shd .ttl small');
  await page.click(width < 600 ? '.phonelist [data-sec=tools]' : '.si3[data-sec=tools]');
  await page.waitForSelector('[data-key="dev.tools"] .sw');
}

for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`Template page at ${width} in ${theme}: off by default, no settings.set, kept on reopen, laid out like an activity`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
        await page.evaluate(() => document.fonts.ready);
        await openTools(page, width);
        assert.equal(await page.locator('[data-card="template"]').count(), 0, 'hidden until the switch is on');
        await page.click('[data-key="dev.tools"] .sw');
        await page.waitForSelector('[data-card="template"] .scene-tab');
        const read = () => page.evaluate(() => {
          const card = document.querySelector('[data-card="template"]');
          const list = card.querySelector('.scene-tab .scene-choice-list');
          const buttons = list ? [...list.querySelectorAll('button')] : [];
          const cs = list ? getComputedStyle(list) : null;
          const body = card.querySelector('.template-body');
          return {
            text: card.textContent,
            display: cs?.display, dir: cs?.flexDirection, count: buttons.length,
            widths: buttons.map(b => Math.round(b.getBoundingClientRect().width)), listW: list ? Math.round(list.getBoundingClientRect().width) : 0,
            sideways: body.scrollWidth > body.clientWidth + 1,
            sets: window.storySuiteHarness.port.recorded.filter(c => c.type === 'settings.set').length,
          };
        });
        const m = await read();
        assert.ok(m.text.includes('Template renderer: for module authors'));
        assert.ok(m.count >= 2, 'the sample has choices');
        assert.equal(m.sideways, false);
        assert.equal(m.sets, 0, 'the switch is not a host setting');
        if (width < 600) {
          assert.equal(m.display, 'flex');
          assert.equal(m.dir, 'column');
          assert.ok(m.widths.every(w => w >= m.listW - 1), `each choice is the list's width: ${m.widths} vs ${m.listW}`);
        } else {
          assert.equal(m.display, 'grid');
        }
        await page.click('button.ibtn.x');
        await page.click('button.ibtn >> visible=true');
        await page.click(width < 600 ? '.phonelist [data-sec=tools]' : '.si3[data-sec=tools]');
        await page.waitForSelector('[data-card="template"] .scene-tab');
        assert.equal((await read()).sets, 0);
      } finally {
        await page.close();
      }
    });
  }
}
