// Rendered check: desktop layout A (owner 18 Nov; mock scratch/design/redo/desktop.html ?layout=a). From a 1100 px suite root, a 360 px left column
// (the character card, then Here now) beside the page column (tab strip, then the tab, up to 1100 px), centred. Numbers are the mock's own
// measurements (night/deskmock/tools/metrics.txt): left column x 24 / 24 / 220, page column x 404 / 404 / 600 and 672 / 852 / 1100 wide.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const MOCK = { 1100: { side: 24, page: 404, pageW: 672 }, 1280: { side: 24, page: 404, pageW: 852, now: '420px 420px' }, 1920: { side: 220, page: 600, pageW: 1100, now: '544px 544px' } };

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

// Waits for the open animation (slide or fade + scale) and any running transition to end, so boxes are measured at rest.
async function settle(page) {
  await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity).length === 0);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function open(width, query, height = 900) {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?width=${width}&${query}`);
  await page.waitForSelector('#hx-frame .su-card-slot .ctop');
  await settle(page);
  return page;
}

/** Runs in the page: the columns' boxes (x from the frame's left edge) and what each holds. */
function measure() {
  const frame = document.querySelector('#hx-frame').getBoundingClientRect();
  const box = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left - frame.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const side = document.querySelector('.su-side');
  const page = document.querySelector('.su-page');
  return {
    side: box('.su-side'), page: box('.su-page'), card: box('.su-card-slot'), here: box('.su-here-slot .su-herenow'), strip: box('.su-strip'), tab: box('.su-panel > *'),
    cardInSide: side.contains(document.querySelector('.su-card-slot .ctop')), stripInPage: page.contains(document.querySelector('.su-strip')),
    rows: document.querySelectorAll('.su-here-slot .hp2').length, nowHere: Boolean(document.querySelector('.now-tab [data-card="here"]')),
    nowGrid: getComputedStyle(document.querySelector('.now-tab') ?? document.body).gridTemplateColumns, mini: getComputedStyle(document.querySelector('.su-mini')).display,
  };
}

for (const width of [1100, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    for (const tab of ['now', 'people', 'bag', 'world']) {
      test(`layout A at ${width} in ${theme} on ${tab}: card and Here now on the left, strip and page on the right`, async t => {
        if (ctx.skip) return t.skip(ctx.skip);
        const page = await open(width, `theme=${theme}&variant=default&tab=${tab}`);
        try {
          const m = await page.evaluate(measure);
          const want = MOCK[width];
          assert.deepEqual([m.side.x, m.side.w], [want.side, 360], `left column ${JSON.stringify(m.side)}`);
          assert.deepEqual([m.page.x, m.page.w], [want.page, want.pageW], `page column ${JSON.stringify(m.page)}`);
          assert.ok(m.cardInSide && m.stripInPage, 'the card sits in the left column, the strip in the page column');
          assert.deepEqual([m.card.x, m.card.w, m.card.y], [want.side, 360, m.side.y], 'the card tops the left column');
          assert.equal(m.here.y, m.card.y + m.card.h + 12, 'Here now sits 12 px under the card');
          assert.equal(m.rows, 4, 'four people present');
          assert.equal(m.strip.y, m.side.y, 'the strip tops the page column, level with the card');
          assert.deepEqual([m.tab.x, m.tab.w], [want.page, want.pageW], 'the tab fills the page column');
          assert.equal(m.mini, 'none', 'no mini bar on desktop');
          if (tab === 'now') {
            assert.equal(m.nowHere, false, 'Now leaves its Here card to Here now');
            if (want.now) assert.equal(m.nowGrid, want.now, 'Now\'s two columns as drawn');
          }
        } finally { await page.close(); }
      });
    }
  }
}

test('layout A: the left column stays put while the page scrolls, and scrolls on its own when taller than the window', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1280, 'theme=dark&variant=default&tab=bag', 800);
  try {
    const before = await page.evaluate(() => document.querySelector('.su-side').getBoundingClientRect().top);
    const after = await page.evaluate(() => { const s = document.querySelector('.su-scroll'); s.scrollTop = 400; return [s.scrollTop, document.querySelector('.su-side').getBoundingClientRect().top]; });
    assert.ok(after[0] > 0, 'the page scrolled');
    assert.equal(Math.round(after[1]), Math.round(before), 'the left column did not move');
    const side = await page.evaluate(() => { const e = document.querySelector('.su-side'); return [e.scrollHeight, e.clientHeight, getComputedStyle(e).overflowY]; });
    assert.equal(side[1], 800 - 32, 'the left column is the window less the 16 px top and bottom');
    assert.ok(side[0] > side[1] && side[2] === 'auto', `the taller column scrolls on its own ${side}`);
  } finally { await page.close(); }
});

test('layout A: Here now follows the chat on any tab, and is left out when nobody is present', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1280, 'theme=dark&variant=default&tab=bag');
  try {
    const names = () => page.evaluate(() => [...document.querySelectorAll('.su-here-slot .hp2 .nl b')].map(b => b.textContent));
    assert.equal((await names()).length, 4);
    await page.evaluate(() => globalThis.storySuiteHarness.port.setVariant({ fightOpen: true }, { notify: true }));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.deepEqual(await names(), ['Torka', 'Brann', 'Rika'], 'a head event redraws Here now on Bag');
    await page.evaluate(() => globalThis.storySuiteHarness.port.setVariant({ empty: true }, { notify: true }));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const empty = await page.evaluate(() => { const s = document.querySelector('.su-here-slot'); return [s.children.length, getComputedStyle(s).display]; });
    assert.deepEqual(empty, [0, 'none']);
  } finally { await page.close(); }
});

test('layout A: crossing 1100 px redraws Now with or without its Here card; text size 120 % keeps the page column 1100 px on screen', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1400, 'theme=dark&variant=default&tab=now');
  try {
    const state = () => page.evaluate(() => ({ nowHere: Boolean(document.querySelector('.now-tab [data-card="here"]')), here: getComputedStyle(document.querySelector('.su-here-slot')).display }));
    const resize = w => page.evaluate(w => new Promise(r => { document.getElementById('hx-frame').style.width = `${w}px`; setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 50); }), w);
    assert.deepEqual(await state(), { nowHere: false, here: 'block' });
    await resize(1099);
    assert.deepEqual(await state(), { nowHere: true, here: 'none' });
    await resize(1100);
    assert.deepEqual(await state(), { nowHere: false, here: 'block' });
    await resize(1400);
    await page.evaluate(() => document.querySelector('.su-root').setAttribute('data-text', '120'));
    await page.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(r), 50)));
    const big = await page.evaluate(() => [document.querySelector('.su-page').getBoundingClientRect().width, document.querySelector('.su-side').getBoundingClientRect().width]);
    assert.equal(Math.round(big[0]), Math.round(1400 - (2 * 24 + 360 + 20) * 1.2), 'the page column takes the rest (under its 1100 px cap)');
    assert.equal(Math.round(big[1]), 432, 'the left column grows with the text');
    await resize(1920);
    const wide = await page.evaluate(() => document.querySelector('.su-page').getBoundingClientRect().width);
    assert.equal(Math.round(wide), 1100, 'the page column stops at 1100 px on screen');
    await resize(1300);
    assert.deepEqual(await state(), { nowHere: true, here: 'none' }, 'at 120 % the switch comes at 1320 px (1100 px of zoomed root)');
  } finally { await page.close(); }
});
