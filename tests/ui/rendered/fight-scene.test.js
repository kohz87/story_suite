// Rendered check: the fight on the Scene tab looks like the Fight tab (same styles, edge-identical header, foes and log cards) at 390, 1143, 1280 and 1920, dark and light; touch taps work at 390×844 and 360×740.
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

const PROPS = ['display', 'padding', 'margin', 'gap', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'color', 'backgroundColor', 'borderRadius', 'borderTopWidth', 'borderTopColor', 'boxShadow', 'width', 'minHeight', 'height'];
const SELECTORS = ['.fhead', '.fhead .t b', '.fhead small', '.fpill', '.foes-card', '.foes-card .ch h3', '.fg', '.mbx', '.party-card', '.actions-card', '.actions-card .ah b', '.at', '.at b', '.at small', '.res2', '.fbtns .btn2', '.log-card', '.log-card .fold'];

/** Runs in the page: the computed values of the first match of each selector. */
function styles({ selectors, props }) {
  return Object.fromEntries(selectors.map(s => {
    const e = document.querySelector(`#hx-frame ${s}`);
    if (!e) return [s, null];
    const cs = getComputedStyle(e);
    return [s, Object.fromEntries(props.map(p => [p, cs[p]]))];
  }));
}

/**
 * Runs in the page: the share of pixels of two PNGs (base64) that differ in their edges, i.e. in the step to the next pixel across and down, by more than 6 in any channel; -1 when the sizes differ.
 * The glass cards blur what is behind them, so two pages can differ by a smooth shade; shapes, text and borders must match.
 */
async function pixelDiff([a, b]) {
  const load = async data => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height); };
  const [x, y] = [await load(a), await load(b)];
  if (x.width !== y.width || x.height !== y.height) return -1;
  const w = x.width;
  let n = 0;
  for (let i = 0; i < x.data.length - 4 * w - 4; i += 4) {
    if ([0, 1, 2].some(k => Math.abs((x.data[i + 4 + k] - x.data[i + k]) - (y.data[i + 4 + k] - y.data[i + k])) > 6 || Math.abs((x.data[i + 4 * w + k] - x.data[i + k]) - (y.data[i + 4 * w + k] - y.data[i + k])) > 6)) n += 1;
  }
  return n / (w * x.height);
}

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
    test(`fight scene at ${width} in ${theme}: the Fight tab's styles, and an edge-identical header, foes and log`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const viewport = { width, height: 2600 }; // tall, so the fixed tab strip stays below the cards
      const old = await open(viewport, theme, 'tab=fight&fight=choose');
      const scene = await open(viewport, theme, 'tab=scene&scene=open&kind=fight&fight=choose');
      try {
        const [a, b] = await Promise.all([old, scene].map(p => p.evaluate(styles, { selectors: SELECTORS, props: PROPS })));
        for (const s of SELECTORS) {
          assert.ok(b[s], `${s} exists on the scene`);
          // the pending member differs (Brann on the Fight tab, Astra first on the scene) and the stance row is hidden: only the frame around them is compared
          if (s.startsWith('.actions-card') || s === '.at' || s.startsWith('.at ') || s === '.res2' || s === '.fbtns .btn2') continue;
          const { height, ...rest } = b[s], { height: was, ...before } = a[s]; // the party card is as tall as its picks
          assert.deepEqual(rest, before, `${s} at ${width} ${theme}`);
          if (s !== '.party-card') assert.equal(height, was, `${s} height at ${width} ${theme}`);
        }
        for (const s of ['.at', '.at b', '.at small', '.res2', '.fbtns .btn2']) assert.deepEqual(b[s], a[s], `${s} at ${width} ${theme}`);
        for (const sel of ['[data-card="fight-head"]', '.foes-card', '.log-card']) {
          const [x, y] = await Promise.all([old, scene].map(p => p.locator(`#hx-frame ${sel}`).first().screenshot({ animations: 'disabled' })));
          const share = await scene.evaluate(pixelDiff, [x.toString('base64'), y.toString('base64')]);
          assert.ok(share >= 0 && share < 0.05, `${sel} differs in its edges at ${width} ${theme}: ${share}`); // blur at the card rim and sub-pixel edges stay under 5%; a moved line or text is far above that
        }
        const m = await scene.evaluate(() => { const tab = document.querySelector('#hx-frame .scene-tab'); return { sideways: tab.scrollWidth > tab.clientWidth + 1, heads: document.querySelectorAll('#hx-frame [data-card="fight-head"]').length, discards: document.querySelectorAll('#hx-frame [data-discard]').length }; });
        assert.deepEqual(m, { sideways: false, heads: 1, discards: 1 });
        assert.equal(await scene.evaluate(() => [...document.querySelectorAll('#hx-frame .fight-tab > *')].length && [...document.querySelector('#hx-frame .fight-tab').childNodes].some(n => n.nodeType === 3)), false, 'no stray text node in the fight');
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          for (const [name, query] of [['choose', 'scene=open&kind=fight&fight=choose'], ['after', 'scene=staged&kind=fight&fight=after'], ['end', 'scene=staged&kind=fight&fight=end']]) {
            const shot = name === 'choose' ? scene : await open(viewport, theme, `tab=scene&${query}`, {}, name);
            await shot.screenshot({ path: path.join(SHOTS, `fight-${name}-${width}-${theme}.png`), fullPage: true });
            if (shot !== scene) await shot.close();
          }
        }
      } finally { await old.close(); await scene.close(); }
    });
  }
}

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  test(`touch at ${size.width}×${size.height}: four picks stage one step; targets and buttons are 44px and reachable, nothing sideways`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(size, 'dark', 'tab=scene&scene=open&kind=fight&fight=choose', { hasTouch: true, isMobile: true });
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
