// Rendered check: pins the mock's fixed values for the Now rows (title, go, glyph tile, late and fight tones, Why, You fold) at phone and tablet.
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
  const pick = (s, ...props) => (s ? Object.fromEntries(props.map(p => [p, s[p]])) : null);
  const tiles = [...document.querySelectorAll('.rnr .ti')].map(e => ({ t: e.textContent.trim(), w: getComputedStyle(e).fontWeight, svg: Boolean(e.querySelector('svg')) }));
  const due = [...document.querySelectorAll('.rnr')].find(e => /Due tomorrow/.test(e.textContent));
  const dueBox = due ? due.getBoundingClientRect() : null;
  const dueTi = due ? due.querySelector('.ti').getBoundingClientRect() : null;
  return {
    b: pick(st('.rnr b'), 'fontSize', 'fontWeight'),
    go: pick(st('.rnr .go'), 'fontSize', 'fontWeight'),
    late: pick(st('.rnr.need-overdue .ti'), 'backgroundColor', 'color'),
    fight: pick(st('.rnr.need-fight'), 'backgroundColor', 'borderTopWidth', 'borderRadius'),
    why: pick(st('.cr .why'), 'paddingTop', 'paddingLeft'),
    fold: pick(st('.you .fold'), 'fontWeight'),
    foldH3: st('.you .fold h3') ? { flex: getComputedStyle(document.querySelector('.you .fold h3')).flexGrow } : null,
    tiles,
    dueIndent: due ? +(dueTi.left - dueBox.left).toFixed(1) : null,
    rowLeft: due ? +(due.querySelector('b').getBoundingClientRect().left - dueBox.left).toFixed(1) : null,
  };
}

for (const [width, size, gap] of [[390, '13.5px', 8], [820, '14px', 10]]) {
  test(`Now rows match the mock at ${width}px`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width, height: 1200 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&variant=fightOpen&width=${width}&tab=now`);
      await page.waitForSelector('#hx-frame .su-host');
      const m = await page.evaluate(measure);
      assert.equal(m.b.fontSize, size);
      assert.equal(m.b.fontWeight, '800');
      assert.equal(m.go.fontSize, width === 390 ? '12.5px' : '13px');
      assert.equal(m.late.backgroundColor, 'rgba(255, 122, 122, 0.15)');
      assert.equal(m.late.color, 'rgb(255, 122, 122)');
      assert.equal(m.fight.backgroundColor, 'rgba(255, 107, 107, 0.08)');
      assert.equal(m.fight.borderTopWidth, '1px');
      assert.equal(m.why.paddingTop, '4px');
      assert.equal(m.why.paddingLeft, '10px');
      assert.equal(m.fold.fontWeight, '800');
      assert.equal(m.foldH3.flex, '0');
      for (const tile of m.tiles.filter(x => ['+', '!', '⛨', '◆', '✉'].includes(x.t))) {
        assert.equal(tile.w, '400', `${tile.t} tile is regular weight`);
        assert.equal(tile.svg, false, `${tile.t} tile is a text glyph`);
      }
      assert.ok(m.tiles.some(x => x.t === '+') && m.tiles.some(x => x.t === '⛨'));
      assert.equal(m.dueIndent, 0, 'the Due tomorrow row is not indented by the journal due pill');
      assert.equal(m.rowLeft, 30 + gap);
      const folded = await page.evaluate(() => Math.round(document.querySelector('.you').getBoundingClientRect().height));
      await page.click('.you .fold');
      const open = await page.evaluate(() => {
        const y = sel => document.querySelector(sel).getBoundingClientRect();
        const card = document.querySelector('.you');
        return { head: card.querySelector('.fold').textContent, srcl2p: y('.you p').top - y('.you .srcl').bottom, p2kv: y('.you .kv2').top - y('.you p').bottom, row: getComputedStyle(card.querySelector('.kv2')).rowGap };
      });
      assert.equal(open.head, '›You', 'the open You header prints no stray text');
      assert.equal(open.srcl2p, 10);
      assert.equal(open.p2kv, 10);
      assert.equal(open.row, '8px');
      await page.click('.you .fold');
      assert.equal(await page.evaluate(() => Math.round(document.querySelector('.you').getBoundingClientRect().height)), folded, 'folding again restores the folded card height');
      assert.equal(folded, 74, 'the folded You card has no empty body gap');
    } finally { await page.close(); }
  });
}

test('Now late and torn tones match the mock in the light scheme', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 1200 } });
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=light&variant=fightOpen&width=390&tab=now`);
    await page.waitForSelector('#hx-frame .su-host');
    const m = await page.evaluate(() => { const e = document.querySelector('.rnr.need-overdue .ti'); return e ? getComputedStyle(e).color : null; });
    assert.ok(m && m !== 'rgb(255, 122, 122)', 'the late glyph uses the light-scheme bad tone');
  } finally { await page.close(); }
});
