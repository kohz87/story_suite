// Rendered check: a captured Combat Rules v1 fight (ui/fixtures/fight-v1.js, the fight kind's own view) on the Scene tab: touch taps at 390×844 and 360×740 pick and target for two heroes and stage one step; the screens at four widths, dark and light.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SHOTS = process.env.C9_SHOTS || '';

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })); });
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

async function open(viewport, theme, query, opts = {}, step = 'choose') {
  const page = await ctx.browser.newPage({ viewport, ...opts });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${viewport.width}&${query}`);
  await page.waitForSelector(`#hx-frame .fight-tab[data-step="${step}"]`);
  await page.evaluate(() => document.fonts.ready);
  return page;
}


const V1 = 'tab=scene&scene=open&kind=fight&fight=real';
const hit = (page, q) => page.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { h: Math.round(r.height), ok: e === top || e.contains(top) }; }, `#hx-frame ${q}`);

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  test(`v1 touch at ${size.width}×${size.height}: attack, target, heal, ally stage one step with the kind's own picks; nothing sideways`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(size, 'dark', V1, { hasTouch: true, isMobile: true });
    try {
      const sel = s => `#hx-frame ${s}`;
      for (const q of ['.actions-card [data-act="normal"]']) { const r = await hit(page, q); assert.ok(r.h >= 44 && r.ok, `${q} ${JSON.stringify(r)}`); }
      await page.tap(sel('.actions-card [data-act="normal"]'));
      await page.waitForSelector(sel('.fight-tab[data-step="target"]'));
      const target = await hit(page, '[data-target="1.2"]');
      assert.ok(target.h >= 44 && target.ok, `target ${JSON.stringify(target)}`);
      await page.tap(sel('[data-target="1.2"]'));
      await page.waitForSelector(sel('.actions-card[data-actor="torka"]'));
      const heal = await hit(page, '.actions-card [data-act="heal"]');
      assert.ok(heal.h >= 44 && heal.ok, `heal ${JSON.stringify(heal)}`);
      await page.tap(sel('.actions-card [data-act="heal"]'));
      await page.waitForSelector(sel('.fight-tab[data-step="ally"]'));
      const ally = await hit(page, '[data-ally="torka"]');
      assert.ok(ally.h >= 44 && ally.ok, `ally ${JSON.stringify(ally)}`);
      await page.tap(sel('[data-ally="torka"]'));
      await page.waitForFunction(() => globalThis.storySuiteHarness.port.recorded.some(r => r.type === 'interaction.stage'));
      const staged = await page.evaluate(() => globalThis.storySuiteHarness.port.recorded.filter(r => r.type === 'interaction.stage').map(r => r.payload.step.inputs.map(i => [i.actor, i.choice, i.args])));
      assert.deepEqual(staged, [[['ac_nf4fuziz', 'normal', { target: '1.2' }], ['ac_weupjjqu', 'heal', { target: 'torka' }]]]);
      assert.equal(await page.evaluate(() => { const tab = document.querySelector('#hx-frame .scene-tab'); return tab.scrollWidth > tab.clientWidth + 1; }), false);
    } finally { await page.close(); }
  });
}

for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`v1 fight screens at ${width} in ${theme}: one header, no sideways scroll, no stray text${SHOTS ? ', shots' : ''}`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const viewport = { width, height: 2600 };
      for (const [name, query, step] of [['choose', V1, 'choose'], ['after', 'tab=scene&scene=staged&kind=fight&fight=realafter', 'after']]) {
        const page = await open(viewport, theme, query, {}, step);
        try {
          const m = await page.evaluate(() => { const tab = document.querySelector('#hx-frame .scene-tab'); return { sideways: tab.scrollWidth > tab.clientWidth + 1, heads: document.querySelectorAll('#hx-frame [data-card="fight-head"]').length, stray: [...document.querySelector('#hx-frame .fight-tab').childNodes].some(n => n.nodeType === 3) }; });
          assert.deepEqual({ sideways: m.sideways, heads: m.heads, stray: m.stray }, { sideways: false, heads: 1, stray: false }, name);
          if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `v1-${name}-${width}-${theme}.png`), fullPage: true }); }
        } finally { await page.close(); }
      }
    });
  }
}
