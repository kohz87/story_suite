// Rendered check: the People dossier and tiles keep the mock's fixed values (corner numbers, name, Following gold, Mood meters, tie portraits, disc colour).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const SIZES = [[390, 844], [820, 1180]];
const GOLD = { dark: 'rgb(240, 184, 74)', light: 'rgb(138, 90, 0)' };
const DISC = { dark: 'rgb(58, 60, 82)', light: 'rgb(74, 77, 104)' };
const TILE = { dark: 'rgb(58, 60, 82)', light: 'rgb(220, 220, 234)' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => {
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

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));


/** Runs in the page: reads the fixed values off the open Temiwa dossier. */
function read() {
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const css = (s, p) => getComputedStyle(q(s))[p];
  const rows = [...document.querySelectorAll('#hx-frame .dcard[data-page="mood"] .mood3 > *')].map(e => e.textContent.trim());
  return {
    name: css('.dossier .dname', 'fontSize'), corner: css('.dossier .ml b', 'fontSize'), spacing: css('.dossier .ml', 'letterSpacing'),
    follow: css('.dossier .fbtn', 'color'), moodRows: rows, here: [...document.querySelectorAll('#hx-frame .dossier .idl')].map(e => e.textContent).at(-1),
    trust: css('.dossier .ml.f0', 'color'),
    ring: ['.bigring .ring-track', '.bigring .ring-arc'].map(s => [q(s).getAttribute('stroke-width'), q(s).getAttribute('r') ?? 'arc']),
    idLh: css('.dossier .idl', 'lineHeight'), bk: css('.dossier .bk2', 'paddingLeft'),
    ph: (() => { const a = q('.bigph').getBoundingClientRect(); const b = q('.bigring').getBoundingClientRect(); return Math.round((a.left - b.left) / b.width * 100); })(),
  };
}

for (const theme of ['dark', 'light']) {
  for (const [width, height] of SIZES) {
    test(`dossier values at ${width}x${height} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=people`);
        await page.waitForSelector('#hx-frame .su-host');
        const tile = await page.evaluate(() => getComputedStyle(document.querySelector('#hx-frame .prg .ph')).backgroundColor);
        assert.equal(tile, TILE[theme], 'People tile disc colour');
        await page.evaluate(() => document.querySelector('#hx-frame [data-person-id="temiwa"]').click());
        await page.waitForSelector('#hx-frame .dossier .mood3');
        const v = await page.evaluate(read);
        assert.equal(v.name, '28px');
        assert.equal(v.corner, '17px');
        assert.equal(v.spacing, '1.2px');
        assert.equal(v.follow, GOLD[theme]);
        assert.equal(v.here, 'Here');
        assert.deepEqual(v.ring[0], ['2.6', '44.7'], 'hero ring track');
        assert.equal(v.ring[1][0], '2.6');
        assert.equal(v.idLh, '19.5px');
        assert.equal(v.bk, '12px');
        assert.equal(v.ph, 17, 'hero portrait inset');
        assert.deepEqual(v.moodRows, ['Feeling', '', '+1', 'Energy', '', '0', 'Control', '', '-1']);
        await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-page="ties"]').click());
        await page.waitForSelector('#hx-frame .dossier .tie');
        const tie = await page.evaluate(() => { const a = document.querySelector('#hx-frame .dossier .tie .a'); const r = a.getBoundingClientRect(); return { w: r.width, img: a.style.backgroundImage, disc: getComputedStyle(a).backgroundColor }; });
        assert.equal(tie.w, 38);
        assert.match(tie.img, /torka/);
        assert.equal(tie.disc, DISC[theme]);
      } finally { await page.close(); }
    });
  }
}
