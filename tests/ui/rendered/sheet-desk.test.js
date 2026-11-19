// Rendered check: the desktop sheet frame (ui/css/sheet-desk.css; approved mock scratch/design/redo/sheets-desktop.html). From a 1100 px suite
// root every sheet but the wizard is a centred 640 px panel, radius 24, over a dim covering the whole window (.58, 3 px blur; light: its own
// colour); the head is 74 px (18 + 44 + 12) and the action row 75 px (a hairline, 12 + 44 + 18) pinned to the panel's bottom while the middle
// scrolls. Under 1100 px the sheets are as before. Numbers are the mock's (night/shb1 shots/mock/mock-parts.json).
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

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity).length === 0);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// The harness fills the window (its control bar hidden), so the suite root is the window, as in SillyTavern's full-width view.
async function open(width, height, theme, tab, clicks, extra = '') {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?width=${width}&theme=${theme}&tab=${tab}${extra}`);
  await page.addStyleTag({ content: '.hx-bar{display:none!important} .hx-frame{height:100vh!important}' });
  await page.waitForSelector('#hx-frame .su-root');
  await settle(page);
  for (const sel of clicks) {
    await page.locator(`#hx-frame ${sel}`).first().dispatchEvent('click');
    await settle(page);
  }
  return page;
}

/** In the page: the last open sheet's overlay, panel, head and pinned action row. */
function measure() {
  const panels = [...document.querySelectorAll('#hx-frame :is(.sh-panel, .pty-sheet, .wov > .wsheet)')];
  const panel = panels[panels.length - 1];
  const ov = panel.parentElement;
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  // (a Bag sheet with its own header: that header is the head; its × sits on it, absolutely placed)
  const head = panel.querySelector(':scope > .ps-body > .bag-sheet > .dh:first-child')
    ?? panel.querySelector(':scope > .sh-h, :scope > .ps-h, :scope > .sh-body > * > :is(.qeh, .sch):first-child, :scope > .dh');
  const x = panel.querySelector('[aria-label="Close"]');
  const foots = [...panel.querySelectorAll('.brow, .ps-row, .pa-acts')].filter(e => getComputedStyle(e).position === 'sticky');
  const foot = foots[foots.length - 1] ?? null;
  const ps = getComputedStyle(panel), os = getComputedStyle(ov);
  return {
    ov: box(ov), panel: box(panel), head: box(head), x: box(x), foot: box(foot), radius: ps.borderTopLeftRadius, scrim: os.backgroundColor, blur: os.backdropFilter,
    footLine: foot ? getComputedStyle(foot).borderTopWidth : null, scroll: [panel.scrollHeight, panel.clientHeight],
  };
}

// Each host: the shared kit sheet (Journal's quest editor), a Party sheet (Stats), a Bag sheet (an item, its own header), World's place sheet.
const SHEETS = [
  { name: 'quest editor', tab: 'journal', clicks: ['.qedit'], foot: true },
  { name: 'Party Stats', tab: 'party', clicks: ['.sv[data-stat="STR"]'], foot: true },
  { name: 'Bag item', tab: 'bag', clicks: ['.itm[data-stack="spare-dagger"]'], foot: true },
  { name: 'World place', tab: 'world', clicks: ['g[data-pl="auvoth"]'], foot: false },
];

// The suite is a floating window (min(1280, window - 48) by min(940, window - 48), centred): the sheets frame to it, not to the screen.
const win = (width, height) => { const w = Math.min(1280, width - 48), h = Math.min(940, height - 48); return { x: (width - w) / 2, y: (height - h) / 2, w, h }; };

for (const [width, height] of [[1280, 800], [1920, 1080]]) {
  for (const theme of ['dark', 'light']) {
    for (const s of SHEETS) {
      test(`desktop sheet at ${width} in ${theme}: ${s.name} is a centred 640 px panel over the floating window's dim`, async t => {
        if (ctx.skip) return t.skip(ctx.skip);
        const page = await open(width, height, theme, s.tab, s.clicks);
        try {
          const m = await page.evaluate(measure);
          const w = win(width, height);
          assert.deepEqual([m.ov.x, m.ov.y, m.ov.w, m.ov.h], [w.x, w.y, w.w, w.h], 'the dim covers the floating window, card column included');
          assert.equal(m.scrim, theme === 'dark' ? 'rgba(6, 8, 16, 0.58)' : 'rgba(30, 26, 60, 0.34)');
          assert.equal(m.blur, 'blur(3px)');
          assert.equal(m.panel.w, 640);
          assert.equal(m.panel.x, w.x + (w.w - 640) / 2, 'centred in the window');
          assert.ok(Math.abs(m.panel.y + m.panel.h / 2 - (w.y + w.h / 2)) <= 1, `centred: ${JSON.stringify(m.panel)}`);
          assert.equal(m.radius, '24px');
          assert.deepEqual([m.head.x, m.head.y, m.head.w], [m.panel.x + 1, m.panel.y + 1, 638], `head ${JSON.stringify(m.head)}`);
          assert.deepEqual([m.x.x - m.panel.x, m.x.w, m.x.h], [573, 44, 44], `× 22 px in from the right: ${JSON.stringify(m.x)}`);
          if (s.foot) {
            assert.deepEqual([m.foot.x, m.foot.w, m.foot.h], [m.panel.x + 1, 638, 75], `action row ${JSON.stringify(m.foot)}`);
            // (a centred panel of odd height sits on a half pixel, so the edges may round 1 px apart)
            assert.ok(Math.abs(m.foot.y + m.foot.h - (m.panel.y + m.panel.h - 1)) <= 1, 'the action row ends at the panel\'s bottom');
            assert.equal(m.footLine, '1px');
          }
        } finally {
          await page.close();
        }
      });
    }
  }
}

test('desktop sheet, short window: the middle scrolls under a pinned head and action row', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1280, 500, 'dark', 'journal', ['.qedit']);
  try {
    const top = await page.evaluate(measure);
    assert.ok(top.scroll[0] > top.scroll[1], `the quest editor scrolls at 1280×500: ${top.scroll}`);
    assert.equal(top.panel.h, win(1280, 500).h - 48, 'the panel fills the floating window (the screen less 48 px) less the dim\'s 24 px each side');
    assert.equal(top.foot.y + top.foot.h, top.panel.y + top.panel.h - 1, 'the action row is on the bottom edge before scrolling');
    await page.evaluate(() => { const p = [...document.querySelectorAll('#hx-frame .sh-panel')].pop(); p.scrollTop = p.scrollHeight; });
    await settle(page);
    const end = await page.evaluate(measure);
    assert.equal(end.head.y, end.panel.y + 1, 'the head stays at the top after scrolling');
    assert.equal(end.foot.y + end.foot.h, end.panel.y + end.panel.h - 1, 'the action row stays on the bottom edge');
  } finally {
    await page.close();
  }
});

test('under 1100 px the sheets are unchanged: the quest editor is the 460 px sheet over the .45 dim at 820, a bottom sheet at 390', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  for (const width of [390, 820]) {
    const page = await open(width, 900, 'dark', 'journal', ['.qedit']);
    try {
      const m = await page.evaluate(measure);
      assert.equal(m.scrim, 'rgba(6, 8, 16, 0.45)');
      assert.equal(m.panel.w, width === 390 ? 390 : 460);
      assert.equal(m.foot, null, 'no pinned action row');
    } finally {
      await page.close();
    }
  }
});

test('desktop: the New character wizard keeps its own frame (not the 640 sheet)', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1280, 800, 'dark', 'now', [], '&wizard=who');
  try {
    const w = await page.evaluate(() => Math.round(document.querySelector('#hx-frame .sh-ov.wz .sh-panel').getBoundingClientRect().width));
    assert.notEqual(w, 640);
  } finally {
    await page.close();
  }
});
