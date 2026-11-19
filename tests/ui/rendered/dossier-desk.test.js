// Rendered check: the dossier on desktop layout A (SHB3; mock scratch/design/redo/sheets-desktop.html, frames dossier and dossier-menu; numbers from
// night/mocksheets/metrics.json). It opens in the page column under the tab strip, at most 1,040 px and centred there, with the card column in view;
// Mood | Right now pair from a 1,000 px dossier; the ⋯ menu drops from its button, right edges flush; under 1,100 px it fills the suite as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
// The mock's dossier: left, width (the page column and the 1,040 cap), and whether Mood and Right now share a row.
const MOCK = { 1280: { left: 404, col: 852, width: 852, paired: false, height: 800 }, 1920: { left: 600, col: 1100, width: 1040, paired: true, height: 1080 } };

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

/** Runs in the page: the dossier's boxes against the page column and the tab strip. */
function measure() {
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const mood = q('.dov .dcard[data-page="mood"]'), now = q('.dov .dcard[data-page="now"]');
  return {
    dov: box(q('.dov')), scroll: box(q('.dov .dscroll')), page: box(q('.su-page')), strip: box(q('.su-strip')), side: box(q('.su-side')), frame: box(q('.su-root')),
    cls: q('.dov').className, panel: getComputedStyle(q('.su-panel')).visibility, background: getComputedStyle(q('.dov')).backgroundImage,
    paired: Boolean(mood && now && Math.abs(mood.getBoundingClientRect().top - now.getBoundingClientRect().top) < 1),
    ties: Math.abs(q('.dov .dcard[data-page="ties"]').getBoundingClientRect().top - q('.dov .dcard[data-page="past"]').getBoundingClientRect().top) < 1,
  };
}

for (const width of [1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`dossier at ${width} ${theme}: in the page column under the strip, at most 1,040 px and centred, the card column in view`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const mock = MOCK[width];
      const page = await openDossier(width, mock.height, theme);
      try {
        const m = await page.evaluate(measure);
        assert.match(m.cls, /\bddesk\b/);
        assert.deepEqual([m.dov.x, m.dov.w, m.dov.b], [mock.left, mock.col, mock.height], 'the dossier covers the page column to the window bottom');
        assert.equal(m.dov.y, m.strip.b + 12, 'just under the tab strip (the page column gap)');
        assert.equal(m.scroll.w, mock.width, 'at most 1,040 px');
        assert.ok(Math.abs((m.scroll.x + m.scroll.w / 2) - (m.page.x + m.page.w / 2)) <= 1, 'centred in the page column');
        assert.ok(m.dov.x >= m.side.r, 'the card column stays in view beside it');
        assert.equal(m.panel, 'hidden', 'the tab under it is hidden');
        assert.equal(m.background, 'none', 'no full-window sky behind it');
        assert.equal(m.paired, mock.paired, 'Mood | Right now share a row only from a 1,000 px dossier');
        assert.equal(m.ties, true, 'Ties | Past side by side');
      } finally { await page.close(); }
    });
  }

  test(`dossier ⋯ menu at ${width}: drops from its button, right edges flush, just under the top bar`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openDossier(width, MOCK[width].height);
    try {
      const before = await page.evaluate(() => document.querySelector('#hx-frame .dgrid').getBoundingClientRect().top);
      await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-act="menu"]').click());
      await settle(page);
      const m = await page.evaluate(() => {
        const r = s => document.querySelector(`#hx-frame ${s}`).getBoundingClientRect();
        return { menu: r('.dossier .menu'), btn: r('.dossier [data-act="menu"]'), top: r('.dossier .dtop'), grid: r('.dgrid').top };
      });
      assert.equal(Math.round(m.menu.right), Math.round(m.btn.right));
      assert.equal(Math.round(m.menu.top), Math.round(m.top.bottom));
      assert.equal(Math.round(m.menu.width), 260);
      assert.equal(m.grid, before, 'the open menu does not push the cards down');
    } finally { await page.close(); }
  });
}

test('dossier across 1,100 px: fills the suite under it, back in the page column above; a tab picked on the strip closes it first', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await openDossier(1280, 800);
  try {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.evaluate(() => { document.querySelector('#hx-frame').style.width = '1000px'; });
    await settle(page);
    let m = await page.evaluate(measure);
    assert.doesNotMatch(m.cls, /\bddesk\b/);
    assert.deepEqual([m.dov.x, m.dov.y, m.dov.w], [m.frame.x, m.frame.y, m.frame.w], 'under 1,100 px the dossier covers the suite as before');
    assert.equal(m.panel, 'visible');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => { document.querySelector('#hx-frame').style.width = '1920px'; });
    await settle(page);
    m = await page.evaluate(measure);
    assert.deepEqual([m.dov.x, m.dov.w, m.scroll.w, m.paired], [600, 1100, 1040, true]);
    await page.evaluate(() => document.querySelector('#hx-frame .su-strip [data-tab="bag"]').click());
    await settle(page);
    const after = await page.evaluate(() => ({ dov: Boolean(document.querySelector('#hx-frame .dov')), tab: document.querySelector('#hx-frame .su-strip [aria-selected="true"]').dataset.tab, panel: getComputedStyle(document.querySelector('#hx-frame .su-panel')).visibility }));
    assert.deepEqual(after, { dov: false, tab: 'bag', panel: 'visible' });
  } finally { await page.close(); }
});
