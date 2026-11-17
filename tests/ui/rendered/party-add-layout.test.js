// Rendered check: Add to party on a person's page (button in the hero, the join card as a sheet) fits the screen at phone and desktop width, dark and light.
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
  for (const width of [390, 1280]) {
    test(`Add to party at ${width} in ${theme}: the button sits in the hero and the join card's three buttons are 44px tall, inside the panel and the screen`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=people`);
      await page.waitForSelector('#hx-frame [data-person-id="temiwa"]');
      await page.evaluate(() => document.fonts.ready);
      await page.click('#hx-frame [data-person-id="temiwa"]');
      await page.waitForSelector('#hx-frame .dossier [data-act="party-add"]');
      const hero = await page.evaluate(() => {
        const b = document.querySelector('#hx-frame [data-act="party-add"]').getBoundingClientRect();
        const h = document.querySelector('#hx-frame .dhero').getBoundingClientRect();
        return { inside: b.left >= h.left && b.right <= h.right, h: b.height };
      });
      assert.equal(hero.inside, true, 'inside the hero card');
      assert.ok(hero.h >= 44, `button height ${hero.h}`);
      if (process.env.PARTYADD_SHOTS) await page.screenshot({ path: `${process.env.PARTYADD_SHOTS}/hero-${width}-${theme}.png` });
      await page.click('#hx-frame [data-act="party-add"]');
      await page.waitForSelector('#hx-frame [data-sheet="party-add"] .sh-panel');
      const got = await page.evaluate(() => {
        const p = document.querySelector('#hx-frame [data-sheet="party-add"] .sh-panel').getBoundingClientRect();
        const buttons = [...document.querySelectorAll('#hx-frame [data-sheet="party-add"] .pa-acts button')].map(b => { const r = b.getBoundingClientRect(); return { label: b.textContent, h: r.height, in: r.left >= p.left - 0.5 && r.right <= p.right + 0.5, clipped: b.scrollWidth > b.clientWidth }; });
        const note = document.querySelector('#hx-frame [data-sheet="party-add"] .pa-note');
        note.textContent = 'The party is full.';
        const probe = document.createElement('i'); probe.style.color = 'var(--su-warn-t)'; note.after(probe);
        const warnColor = getComputedStyle(probe).color; probe.remove();
        const noteColor = getComputedStyle(note).color, rowColor = getComputedStyle(document.querySelector('#hx-frame [data-sheet="party-add"] .pa-row')).color;
        return { noteColor, rowColor, warnColor, buttons, panel: { l: p.left, r: p.right, b: p.bottom }, vw: window.innerWidth, vh: window.innerHeight };
      });
      if (process.env.PARTYADD_SHOTS) await page.screenshot({ path: `${process.env.PARTYADD_SHOTS}/card-${width}-${theme}.png` });
      await page.close();
      assert.ok(got.noteColor && got.noteColor === got.warnColor && got.noteColor !== got.rowColor, `the refusal note is in the warning colour, not the text colour (${got.noteColor})`);
      assert.deepEqual(got.buttons.map(b => b.label), ['Add to party', 'Edit first', 'Not now']);
      for (const b of got.buttons) { assert.ok(b.h >= 44, `${b.label} ${b.h}`); assert.equal(b.in, true, `${b.label} inside the panel`); assert.equal(b.clipped, false, `${b.label} not clipped`); }
      assert.ok(got.panel.l >= 0 && got.panel.r <= got.vw && got.panel.b <= got.vh + 1, 'panel inside the screen');
    });
  }
}
