// Rendered check: pins the mock's Now person-card, Wants, spoiler switch and pinned tracker values at phone and tablet width, dark and light.
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

function measure() {
  const st = (sel, i = 0) => { const e = document.querySelectorAll(sel)[i]; return e ? getComputedStyle(e) : null; };
  const pick = (s, ...p) => (s ? Object.fromEntries(p.map(k => [k, s[k]])) : null);
  const bar = document.querySelector('.fld .fbar');
  return {
    star: pick(st('.prg .star'), 'color'),
    ph: pick(st('.prg .ph', [...document.querySelectorAll('.prg .ph')].findIndex(e => e.textContent.trim() && getComputedStyle(e).color !== 'rgba(0, 0, 0, 0)')), 'fontSize', 'color', 'backgroundColor'),
    link: pick(st('.dossier-link'), 'paddingLeft', 'paddingRight'),
    dt: pick(st('.hp2 dt'), 'paddingTop'),
    wants: pick(st('.hp2 .sec2 dt'), 'color'),
    fld: pick(st('.fld'), 'gridTemplateColumns', 'paddingTop'),
    barH: bar ? bar.getBoundingClientRect().height : null,
    feel: ['f0', 'f1', 'f2', 'f3'].map(f => st(`.hp2 .fl2 .${f}`).color),
    arcs: ['f0', 'f3'].map(f => st(`.now-tab .ring-arc.${f}`)?.stroke ?? null),
    nlGap: pick(st('.hp2 .nl'), 'rowGap', 'columnGap'),
    more: pick(st('.more2'), 'paddingLeft', 'paddingRight'),
    bars: [...document.querySelectorAll('.now-tab .fbar b')].map(b => [b.className, getComputedStyle(b).backgroundColor]),
    pitch: (() => {
      const card = document.querySelector('.now-tab [data-card="pinned"]'); if (!card) return null;
      const rows = [...card.querySelectorAll('.fld')].map(r => r.getBoundingClientRect().top);
      return { cls: card.classList.contains('trkmini'), gap: getComputedStyle(card).rowGap, rows: rows.slice(1).map((y, i) => y - rows[i]), titleToLast: [...card.querySelectorAll('.fld>span:first-child')].at(-1).getBoundingClientRect().top - card.querySelector('.ch h3').getBoundingClientRect().top };
    })(),
    sw: (() => {
      const b = document.querySelector('.now-tab .spo .sw'); const r = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after'); const p = getComputedStyle(b, '::before');
      return { box: [r.width, r.height], pill: [p.width, p.height], thumb: [a.width, a.height], margin: getComputedStyle(b).margin };
    })(),
  };
}

// The mock's per-scheme --m0..m3 feeling colours, --pk-gold star and initial disc (light: #dcdcea with a #1d2030 letter).
const WANT = {
  dark: { star: 'rgb(240, 184, 74)', bg: 'rgb(58, 60, 82)', letter: 'rgb(255, 255, 255)', wants: 'rgb(192, 138, 255)', feel: ['rgb(90, 160, 255)', 'rgb(255, 122, 168)', 'rgb(192, 138, 255)', 'rgb(240, 184, 74)'] },
  light: { star: 'rgb(138, 90, 0)', bg: 'rgb(220, 220, 234)', letter: 'rgb(29, 32, 48)', wants: 'rgb(110, 48, 196)', feel: ['rgb(31, 95, 191)', 'rgb(184, 38, 95)', 'rgb(122, 63, 192)', 'rgb(138, 90, 0)'] },
};
for (const theme of ['dark', 'light']) for (const width of [390, 820]) {
  test(`Now person card and pinned tracker match the mock at ${width}px, ${theme}`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width, height: 1400 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=${width}&tab=now`);
      await page.waitForSelector('#hx-frame .su-host');
      await page.click('.more2');
      await page.waitForFunction(() => { const e = document.querySelector('.hp2 dt'); return e && getComputedStyle(e).paddingTop === '2px'; });
      const m = await page.evaluate(measure);
      const w = WANT[theme];
      assert.equal(m.star.color, w.star);
      assert.equal(m.ph.fontSize, '22px');
      assert.equal(m.ph.color, w.letter);
      assert.equal(m.ph.backgroundColor, w.bg);
      assert.equal(m.link.paddingLeft, '6px');
      assert.equal(m.link.paddingRight, '6px');
      assert.equal(m.dt.paddingTop, '2px');
      if (m.wants) assert.equal(m.wants.color, w.wants);
      assert.deepEqual(m.feel, w.feel, 'T / A / D / Tn numbers');
      assert.deepEqual(m.arcs, ['rgb(90, 160, 255)', 'rgb(240, 184, 74)'], 'ring arcs keep the fixed colours in both schemes');
      assert.deepEqual(m.nlGap, { rowGap: '6px', columnGap: '6px' }, 'name row gap, also between wrapped lines');
      assert.deepEqual(m.more, { paddingLeft: '4px', paddingRight: '4px' }, 'Doing, wearing, wants ▾');
      assert.deepEqual(m.sw, { box: [62, 46], pill: ['54px', '26px'], thumb: ['18px', '18px'], margin: '-10px -4px' }, 'scene spoiler switch');
      assert.deepEqual(m.bars, [['bad', 'rgb(255, 122, 122)'], ['ok', 'rgb(79, 211, 154)']], 'tracker bars are fixed red and green');
      assert.deepEqual(m.pitch, { cls: true, gap: '2px', rows: [28, 28], titleToLast: 98 }, 'pinned rows 28px apart, title to Due 98px');
      if (m.fld) {
        assert.equal(m.fld.paddingTop, '4px');
        assert.match(m.fld.gridTemplateColumns, /^76px /);
        assert.equal(m.barH, 7);
      }
    } finally { await page.close(); }
  });
}
