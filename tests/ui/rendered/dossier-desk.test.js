// Rendered check: the dossier's layout by window width. On a desktop window (1,100 px and up) it covers the whole suite in three columns once a part is open
// (portrait 290, the cards, the part 360 beside them); below, a part is a page of its own (the tablet keeps the portrait column). The ⋯ menu drops from its button.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

let ctx = null;
test.before(async () => {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    ctx = { browser, ...(await serve()) };
  } catch (err) {
    if (process.env.CI === 'true') throw err;
    ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
  }
});
test.after(async () => {
  if (ctx?.browser) await ctx.browser.close();
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function openDossier(width, height, theme = 'dark') {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=people`);
  await page.waitForSelector('#hx-frame .su-host');
  await page.addStyleTag({ content: '#hx-controls{display:none!important} .hx-frame{height:100vh!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelector('#hx-frame [data-person-id="temiwa"]').click());
  await settle(page);
  return page;
}


/** Runs in the page: the dossier's boxes against the suite root. */
function measure() {
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const shown = s => { const e = q(s); return Boolean(e) && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  return {
    dov: box(q('.dov')), root: box(q('.su-root')), bar: box(q('.dov .dbar')), hero: box(q('.dov .dhero')), cards: box(q('.dov .dcards')), pane: box(q('.dov .dpane')), dh: box(q('.dov .dpane .dh')),
    shown: { hero: shown('.dov .dhero'), cards: shown('.dov .dcards'), pane: shown('.dov .dpane'), back: shown('.dov .dpane [data-act="back"]') },
    ties: Math.abs(q('.dov .dcard[data-page="ties"]').getBoundingClientRect().top - q('.dov .dcard[data-page="past"]').getBoundingClientRect().top) < 1,
    sel: [...document.querySelectorAll('#hx-frame .dov .dcard.sel')].map(c => c.dataset.page), lib: box(q('.dov .dlib')),
  };
}

for (const width of [1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`dossier at ${width} ${theme}: covers the whole suite; portrait column 290 and the cards, then a part opens beside the cards (360) with its card outlined`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await openDossier(width, width === 1280 ? 800 : 1080, theme);
      try {
        const m = await page.evaluate(measure);
        assert.deepEqual([m.dov.x, m.dov.y, m.dov.w], [m.root.x, m.root.y, m.root.w], 'the dossier covers the suite');
        assert.equal(m.bar.h, 64, 'top bar 64 px');
        assert.equal(m.hero.w, 290, 'portrait column');
        assert.equal(m.cards.x, m.hero.x + 290);
        assert.equal(m.pane, null, 'no part open yet: two columns');
        assert.equal(m.ties, true, 'Ties | Past side by side');
        assert.equal(m.lib.h, 60, 'the folded library strip');
        await page.evaluate(() => document.querySelector('#hx-frame .dov .dcard[data-page="mood"]').click());
        await settle(page);
        const o = await page.evaluate(measure);
        assert.deepEqual(o.shown, { hero: true, cards: true, pane: true, back: false }, 'three columns; no ‹ Dossier beside the cards');
        assert.equal(o.pane.w, 360, 'the part column');
        assert.equal(o.pane.x + o.pane.w, o.dov.x + o.dov.w);
        assert.equal(o.cards.x + o.cards.w, o.pane.x, 'the part sits right beside the cards');
        assert.equal(o.dh.h, 64, 'the part header lines up with the top bar');
        assert.deepEqual(o.sel, ['mood'], 'the open part\'s card is outlined');
      } finally { await page.close(); }
    });
  }
}

for (const [width, height] of [[820, 1000], [390, 844]]) {
  test(`dossier at ${width}: a part opens as a page of its own with ‹ Dossier (the portrait column ${width < 600 ? 'goes too' : 'stays'})`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openDossier(width, height);
    try {
      const m = await page.evaluate(measure);
      assert.deepEqual([m.shown.hero, m.shown.cards], [true, true]);
      if (width >= 600) assert.equal(m.hero.w, 300, 'tablet portrait column');
      await page.evaluate(() => document.querySelector('#hx-frame .dov .dcard[data-page="past"]').click());
      await settle(page);
      const o = await page.evaluate(measure);
      assert.deepEqual(o.shown, { hero: width >= 600, cards: false, pane: true, back: true });
      await page.evaluate(() => document.querySelector('#hx-frame .dov .dpane [data-act="back"]').click());
      await settle(page);
      assert.deepEqual((await page.evaluate(measure)).shown, { hero: true, cards: true, pane: false, back: false });
    } finally { await page.close(); }
  });
}

for (const width of [1280]) {
  test(`dossier ⋯ menu at ${width}: drops from its button, just under the top bar`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openDossier(width, width === 1280 ? 800 : 1080);
    try {
      await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-act="menu"]').click());
      await settle(page);
      const m = await page.evaluate(() => {
        const r = s => document.querySelector(`#hx-frame ${s}`).getBoundingClientRect();
        return { menu: r('.dossier .menu'), btn: r('.dossier [data-act="menu"]') };
      });
      assert.ok(m.menu.right <= m.btn.right + 12 && m.menu.right >= m.btn.right, `menu right ${m.menu.right} by the button ${m.btn.right}`);
      assert.ok(m.menu.top >= m.btn.bottom + 7 && m.menu.top <= m.btn.bottom + 9, `menu top ${m.menu.top} 8 px under the button ${m.btn.bottom}`);
    } finally { await page.close(); }
  });
}
