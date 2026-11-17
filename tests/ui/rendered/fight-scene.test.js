// Rendered check: the Fight tab (the activity host with the fight renderer) has one header, one Discard, no stray text and nothing sideways at 390, 1143, 1280 and 1920, dark and light; touch taps work at 390×844 and 360×740.
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

for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`fight tab at ${width} in ${theme}: one header, one Discard, no stray text, nothing sideways`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const viewport = { width, height: 2600 }; // tall, so the fixed tab strip stays below the cards
      const scene = await open(viewport, theme, 'tab=fight&scene=open&kind=fight&fight=choose');
      try {
        const m = await scene.evaluate(() => { const tab = document.querySelector('#hx-frame .scene-tab'); return { sideways: tab.scrollWidth > tab.clientWidth + 1, heads: document.querySelectorAll('#hx-frame [data-card="fight-head"]').length, discards: document.querySelectorAll('#hx-frame [data-discard]').length }; });
        assert.deepEqual(m, { sideways: false, heads: 1, discards: 1 });
        assert.equal(await scene.evaluate(() => [...document.querySelectorAll('#hx-frame .fight-tab > *')].length && [...document.querySelector('#hx-frame .fight-tab').childNodes].some(n => n.nodeType === 3)), false, 'no stray text node in the fight');
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          for (const [name, query] of [['choose', 'scene=open&kind=fight&fight=choose'], ['after', 'scene=staged&kind=fight&fight=after'], ['end', 'scene=staged&kind=fight&fight=end']]) {
            const shot = name === 'choose' ? scene : await open(viewport, theme, `tab=fight&${query}`, {}, name);
            await shot.screenshot({ path: path.join(SHOTS, `fight-${name}-${width}-${theme}.png`), fullPage: true });
            if (shot !== scene) await shot.close();
          }
        }
      } finally { await scene.close(); }
    });
  }
}

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  test(`touch at ${size.width}×${size.height}: four picks stage one step; targets and buttons are 44px and reachable, nothing sideways`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(size, 'dark', 'tab=fight&scene=open&kind=fight&fight=choose', { hasTouch: true, isMobile: true });
    try {
      const sel = s => `#hx-frame ${s}`;
      const hit = async s => page.evaluate(q => { const e = document.querySelector(q); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { h: Math.round(r.height), ok: e === top || e.contains(top) }; }, sel(s));
      const tiles = await hit('.actions-card [data-act="normal"]');
      assert.ok(tiles.h >= 44 && tiles.ok, `tile ${JSON.stringify(tiles)}`);
      await page.tap(sel('.actions-card [data-act="normal"]'));
      await page.waitForSelector(sel('.fight-tab[data-step="target"]'));
      const target = await hit('[data-target="Hound 2"]');
      assert.ok(target.h >= 44 && target.ok, `target ${JSON.stringify(target)}`);
      await page.tap(sel('[data-target="Hound 2"]'));
      await page.waitForSelector(sel('.actions-card[data-actor="torka"]'));
      for (const [act, who, next, foe] of [['brute', 'torka', 'rika', 'Captain'], ['aimed', 'rika', 'brann', 'Captain']]) {
        await page.tap(sel(`.actions-card [data-act="${act}"]`));
        await page.tap(sel(`[data-target="${foe}"]`));
        await page.waitForSelector(sel(`.actions-card[data-actor="${next}"]`));
        assert.equal(await page.evaluate(() => document.querySelectorAll('#hx-frame .actions-card').length), 1, who);
      }
      const hasSideways = () => page.evaluate(() => { const tab = document.querySelector('#hx-frame .scene-tab'); return tab.scrollWidth > tab.clientWidth + 1; });
      assert.equal(await hasSideways(), false);
      const act = await hit('[data-discard]');
      assert.ok(act.h >= 44 && act.ok, `discard ${JSON.stringify(act)}`);
      await page.tap(sel('.actions-card [data-act="normal"]'));
      await page.tap(sel('[data-target="Hound 3"]'));
      await page.waitForFunction(() => globalThis.storySuiteHarness.port.recorded.some(r => r.type === 'interaction.stage'));
      const staged = await page.evaluate(() => globalThis.storySuiteHarness.port.recorded.filter(r => r.type === 'interaction.stage').map(r => r.payload.step.inputs.map(i => [i.actor, i.choice])));
      assert.deepEqual(staged, [[['actor-astra', 'attack'], ['actor-torka', 'skill'], ['actor-rika', 'skill'], ['actor-brann', 'attack']]]);
    } finally { await page.close(); }
  });
}
