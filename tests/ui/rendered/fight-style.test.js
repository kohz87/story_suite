// Rendered check: the Fight tab in the dev harness (fight open) keeps the mock's fixed values at phone width, dark and light.
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
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
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

/** Runs in the page: the computed values this job fixed. */
function measure() {
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const cs = (s, k) => getComputedStyle(q(s))[k];
  const sw = q('.stance .sw').getBoundingClientRect();
  const rows = [...document.querySelectorAll('#hx-frame .foes-card .fline')].map(e => e.getBoundingClientRect());
  return {
    smallH: Math.round(q('.fight-tab .fhead .t small').getBoundingClientRect().height),
    headH: Math.round(q('.fight-tab .fhead').getBoundingClientRect().height),
    bLine: cs('.fight-tab .fhead .t b', 'lineHeight'),
    pill: cs('.fpill', 'color'),
    elite: cs('.tier.Elite', 'color'),
    longShot: cs('.at .odds.long', 'color'),
    area: cs('.at.area small', 'color'),
    agrp: cs('.agrp', 'marginBottom'),
    foldFont: cs('.fold', 'fontSize') + ' ' + cs('.fold', 'lineHeight'),
    swW: sw.width,
    swTrack: getComputedStyle(q('.stance .sw'), '::before').width,
    swTrackH: getComputedStyle(q('.stance .sw'), '::before').height,
    swTrackTop: getComputedStyle(q('.stance .sw'), '::before').top,
    foeRowGap: rows.length > 1 ? Math.round(rows[1].top - rows[0].bottom) : null,
    foldPad: cs('.party-card', 'paddingTop'),
  };
}

const EXPECT = {
  dark: { pill: 'rgb(255, 122, 122)', elite: 'rgb(240, 184, 74)', longShot: 'rgb(255, 154, 122)', area: 'rgb(240, 184, 74)' },
  light: { pill: 'rgb(180, 35, 24)', elite: 'rgb(138, 83, 0)', longShot: 'rgb(168, 54, 26)', area: 'rgb(138, 83, 0)' },
};

for (const theme of ['dark', 'light']) {
  test(`fight tab at 390 in ${theme}: header, tier and odds colours, switch, fold and gaps match the mock`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&variant=fightOpen&tab=fight`);
      await page.waitForFunction(() => { const p = document.querySelector('#hx-frame .fpill'); return p && /^rgb\((255, 122, 122|180, 35, 24)\)$/.test(getComputedStyle(p).color); });
      await page.waitForSelector('#hx-frame .fight-tab .stance .sw');
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(measure);
      const e = EXPECT[theme];
      assert.equal(m.smallH, 32);
      assert.equal(m.headH, 80);
      assert.equal(m.bLine, 'normal');
      assert.equal(m.pill, e.pill);
      assert.equal(m.elite, e.elite);
      assert.equal(m.longShot, e.longShot);
      assert.equal(m.area, e.area);
      assert.equal(m.agrp, '0px');
      assert.equal(m.foldFont, '14px normal');
      assert.equal(m.swW, 54);
      assert.equal(m.swTrack, '54px');
      assert.equal(m.swTrackH, '26px');
      assert.equal(m.swTrackTop, '11px');
      assert.equal(m.foeRowGap, 8);
      assert.equal(m.foldPad, '8px');
    } finally { await page.close(); }
  });
}

test('fight tab at 820: header keeps the mock height (subtitle 16, header 64)', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1000 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=820&variant=fightOpen&tab=fight`);
    await page.waitForFunction(() => { const p = document.querySelector('#hx-frame .fpill'); return p && getComputedStyle(p).color === 'rgb(255, 122, 122)'; });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await page.evaluate(measure);
    assert.equal(m.smallH, 16);
    assert.equal(m.headH, 64);
  } finally { await page.close(); }
});
