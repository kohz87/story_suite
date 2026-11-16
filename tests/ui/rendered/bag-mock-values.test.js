// Rendered check: the Bag tab at 390 and 820, dark and light, keeps the approved mock's fixed values (tile text, purse units, filter chips, pace, item sheet).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SIZES = [[390, 844], [820, 1180]];

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

/** Runs in the page: reads the computed values of the Bag parts, closing the Assets fold open first. */
function measure() {
  const frame = document.getElementById('hx-frame');
  const q = s => frame.querySelector(s);
  const st = (s, props) => { const el = q(s); if (!el) return null; const c = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, c[p]])); };
  const fold = q('.afold');
  if (fold.getAttribute('aria-expanded') !== 'true') fold.click();
  return {
    unit: st('.coin small', ['fontSize', 'fontWeight']),
    name: st('.itm .n', ['fontSize', 'fontWeight', 'lineHeight', 'webkitLineClamp']),
    kind: st('.itm .k', ['fontSize', 'fontWeight', 'lineHeight', 'marginTop']),
    chips: st('.fil', ['marginLeft', 'paddingLeft']),
    chip: st('.fil button', ['paddingLeft', 'fontSize']),
    chipCount: st('.fil button small', ['fontSize']),
    fold: st('.afold', ['fontSize', 'fontWeight']),
    sub: st('.asub', ['letterSpacing', 'marginTop']),
    lr: st('.load .lr', ['paddingTop', 'paddingBottom', 'columnGap']),
    body: st('.abody', ['display']),
  };
}

for (const theme of ['dark', 'light']) {
  for (const [width, height] of SIZES) {
    test(`bag at ${width}x${height} in ${theme} keeps the mock values`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=bag`);
        await page.waitForSelector('#hx-frame .bag-tab .itm');
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(measure);
        assert.deepEqual(m.unit, { fontSize: '14.45px', fontWeight: '700' }, 'purse unit labels are 85% of the 17px amount');
        assert.deepEqual(m.name, { fontSize: '12px', fontWeight: '700', lineHeight: '14.4px', webkitLineClamp: '2' }, 'tile name');
        assert.deepEqual(m.kind, { fontSize: '12px', fontWeight: '600', lineHeight: '13.2px', marginTop: '-3px' }, 'tile kind');
        assert.deepEqual(m.chips, { marginLeft: '-2px', paddingLeft: '2px' }, 'filter row offset');
        assert.deepEqual(m.chip, { paddingLeft: '12px', fontSize: '12.5px' }, 'filter chip');
        assert.equal(m.chipCount.fontSize, '12px', 'filter count');
        assert.deepEqual(m.fold, { fontSize: '13.5px', fontWeight: '700' }, 'Assets fold row');
        assert.deepEqual(m.sub, { letterSpacing: '1.44px', marginTop: '4px' }, 'Transport / Property label');
        assert.deepEqual(m.lr, { paddingTop: '8px', paddingBottom: '8px', columnGap: '10px' }, 'party load row');
        assert.equal(m.body.display, 'block', 'Assets body stacks with the labels own 4px margin');
        assert.equal(await page.evaluate(() => document.querySelector('#hx-frame .pacebox p').textContent.includes('rowboat')), false, 'pace note is the mock one');
        await page.evaluate(() => [...document.querySelectorAll('#hx-frame .itm')].find(i => i.textContent.includes('Spare dagger')).click());
        await page.waitForSelector('.bag-sheet .wbar');
        const sheet = await page.evaluate(() => {
          const c = s => { const x = getComputedStyle(document.querySelector(s)); return { fs: x.fontSize, fw: x.fontWeight, fst: x.fontStyle }; };
          const w = getComputedStyle(document.querySelector('.bag-sheet .wbar')); const wi = getComputedStyle(document.querySelector('.bag-sheet .wbar i'));
          return { wbar: [w.columnGap, w.marginRight, wi.height, wi.borderTopLeftRadius], dn: c('.bag-sheet .dn'), desc: c('.bag-sheet .desc'), from: document.querySelector('.bag-sheet .bfrom')?.textContent ?? '' };
        });
        assert.deepEqual(sheet.wbar, ['2px', '0px', '5px', '2px'], 'wear bar: gap 2, no margin, 5px high');
        assert.deepEqual(sheet.dn, { fs: '20px', fw: '800', fst: 'normal' }, 'item name');
        assert.deepEqual(sheet.desc, { fs: '13.5px', fw: '500', fst: 'italic' }, 'item description');
        assert.match(sheet.from, /^Bought in .+ ›$/, 'the Bought in line is a link line');
        const x = await page.evaluate(() => {
          const b = document.querySelector('.ps-x'); const c = getComputedStyle(b); const r = b.getBoundingClientRect();
          const sh = document.querySelector('.pty-sheet').getBoundingClientRect(); const tl = document.querySelector('.bag-sheet .dh .tl').getBoundingClientRect();
          return { box: [r.width, r.height], font: [c.fontSize, c.fontWeight], pad: [c.paddingTop, c.paddingLeft], radius: c.borderTopLeftRadius, border: c.borderTopWidth, right: sh.right - r.right, mid: r.top + r.height / 2 - (tl.top + tl.height / 2), title: getComputedStyle(document.querySelector('.ps-h>div')).display, sheetTop: tl.top - sh.top };
        });
        assert.deepEqual(x.box, [44, 44], 'close button box');
        assert.deepEqual(x.font, ['16px', '800'], 'close × font');
        assert.deepEqual([x.pad, x.radius, x.border], [['1px', '6px'], '10px', '0px'], 'close × padding, radius, no border');
        assert.equal(x.title, 'none', 'no second title row: the tile row is the header');
        assert.equal(Math.abs(x.mid) < 0.6, true, `close × centred on the tile row (${x.mid})`);
        assert.equal(x.right, width > 600 ? 20 + 1 : 18 + 1, 'close × sits at the sheet padding');
        assert.equal(x.sheetTop, width > 600 ? 18 + 1 : 26 + 1, 'tile row starts right under the sheet padding');
        const glyphs = await page.evaluate(() => { const t = document.querySelector('.bag-sheet .tl svg'); return t ? t.querySelectorAll('path').length : 0; });
        assert.equal(glyphs >= 1, true);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    test(`bag colours at ${width}x${height} in ${theme} are the mock's fixed values`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=bag&bag=over`);
        await page.waitForSelector('#hx-frame .bag-tab .itm');
        const c = await page.evaluate(() => {
          const f = document.getElementById('hx-frame');
          if (f.querySelector('.afold').getAttribute('aria-expanded') !== 'true') f.querySelector('.afold').click();
          const g = (s, p) => { const el = f.querySelector(s); return el ? getComputedStyle(el)[p] : null; };
          return {
            unc: g('.tl.r-unc', 'borderTopColor'), rare: g('.tl.r-rare', 'borderTopColor'), epic: (() => { const t = f.querySelector('.tl'); t.classList.add('r-epic'); return getComputedStyle(t).borderTopColor; })(),
            neg: g('.last b:not(.up)', 'color'), pos: g('.last b.up', 'color'),
            eq: g('.tr .tg.eq', 'backgroundColor'), ovr: g('.ovr', 'backgroundColor'), ovrBorder: g('.ovr', 'borderTopColor'),
          };
        });
        assert.deepEqual([c.unc, c.rare, c.epic], ['rgba(79, 211, 154, 0.6)', 'rgba(90, 160, 255, 0.7)', 'rgba(190, 120, 255, 0.7)'], 'tile rarity borders are the soft tints');
        assert.equal(c.neg, theme === 'light' ? 'rgb(179, 38, 30)' : 'rgb(255, 107, 107)', 'This turn spent amount');
        assert.equal(c.pos, theme === 'light' ? 'rgb(13, 122, 79)' : 'rgb(79, 211, 154)', 'This turn gained amount');
        assert.equal(c.eq, 'rgba(168, 151, 255, 0.14)', 'equipped tag tint');
        assert.equal(c.ovr, 'rgba(242, 180, 90, 0.1)', 'over banner tint');
        assert.equal(c.ovrBorder, 'rgba(242, 180, 90, 0.35)', 'over banner border');
      } finally { await page.close(); }
    });
  }
}

test('Story-only Transport rows have no tag, are 55px high, and the pace note is the Story text', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=390&tab=bag&variant=rpgOff`);
    await page.waitForSelector('#hx-frame .bag-tab .itm');
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const f = document.getElementById('hx-frame');
      if (f.querySelector('.afold').getAttribute('aria-expanded') !== 'true') f.querySelector('.afold').click();
      const rows = [...f.querySelectorAll('.tr')];
      return { heights: rows.slice(0, 2).map(x => x.getBoundingClientRect().height), tags: rows.slice(0, 2).map(x => x.querySelectorAll('.tg').length), rider: f.querySelector('.rg').getBoundingClientRect().width, pace: f.querySelector('.pacebox p').textContent };
    });
    assert.deepEqual(r.tags, [0, 0], 'no equipped tag in Story-only');
    assert.deepEqual(r.heights, [55, 56], 'rows as high as the mock (the second has the 1px divider)');
    assert.equal(r.rider, 118, 'rider label keeps the leading nbsp');
    assert.equal(r.pace, 'On foot: not everyone has a riding animal, so everyone walks. Riders lead their animals.');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('the Sealed letter and Guild writ tiles draw the mock page with three text lines', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1180 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=820&tab=bag`);
    await page.waitForSelector('#hx-frame .bag-tab .itm');
    const q = await page.evaluate(() => [...document.querySelectorAll('#hx-frame .tl[data-glyph="quest"]')].map(el => [...el.querySelectorAll('path')].map(p => p.getAttribute('d'))));
    assert.equal(q.length >= 2, true, 'quest tiles are there');
    for (const paths of q) assert.deepEqual(paths, ['M6 3h12a2 2 0 0 1 2 2v3h-3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7.5 9h6M7.5 12.5h6M7.5 16h4']);
  } finally { await page.close(); }
});

for (const [theme, over] of [['dark', 'rgb(255, 123, 114)'], ['light', 'rgb(179, 38, 30)']]) {
  test(`the Over load number is the mock's ${theme} red`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1180 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=820&tab=bag&bag=over`);
      await page.waitForSelector('#hx-frame .load.over .lr b');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hx-frame .load.over .lr b')).color), over);
    } finally { await page.close(); }
  });
}

test('Bag rules change no other tab: World chips keep no negative margin, Story avatars are not Bag-sized', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=390&tab=world`);
    await page.waitForSelector('#hx-frame .world-tab');
    const w = await page.evaluate(() => [...document.querySelectorAll('#hx-frame .fil')].map(f => getComputedStyle(f).marginLeft));
    assert.deepEqual(w.filter(m => m !== '0px'), [], 'no World chip row is offset by Bag');
    const sets = await page.evaluate(() => {
      const probe = document.createElement('span'); probe.className = 'av'; document.getElementById('hx-frame').appendChild(probe);
      const cs = getComputedStyle(probe); const r = [cs.width, cs.borderTopLeftRadius]; probe.remove(); return r;
    });
    assert.notDeepEqual(sets, ['20px', '50%'], 'a bare .av outside Bag is no longer sized by bag.css');
  } finally { await page.close(); }
});
