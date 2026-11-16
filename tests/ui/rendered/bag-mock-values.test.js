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
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > 8999) { reject(new Error('no free port in 8800-8999')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8900);
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
        await page.evaluate(() => document.querySelector('#hx-frame .itm').click());
        await page.waitForSelector('.bag-sheet .dn');
        const sheet = await page.evaluate(() => {
          const c = s => { const x = getComputedStyle(document.querySelector(s)); return { fs: x.fontSize, fw: x.fontWeight, fst: x.fontStyle }; };
          return { dn: c('.bag-sheet .dn'), desc: c('.bag-sheet .desc'), from: document.querySelector('.bag-sheet .bfrom')?.textContent ?? '' };
        });
        assert.deepEqual(sheet.dn, { fs: '20px', fw: '800', fst: 'normal' }, 'item name');
        assert.deepEqual(sheet.desc, { fs: '13.5px', fw: '500', fst: 'italic' }, 'item description');
        assert.match(sheet.from, /^Bought in .+ ›$/, 'the Bought in line is a link line');
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  }
}
