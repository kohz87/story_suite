// Rendered check: pins the mock's Now person-card, Wants and pinned tracker values at tablet width, dark and light.
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
  };
}

const WANT = {
  dark: { star: 'rgb(240, 184, 74)', bg: 'rgb(58, 60, 82)', wants: 'rgb(192, 138, 255)' },
  light: { star: 'rgb(138, 86, 0)', bg: 'rgb(74, 77, 104)', wants: 'rgb(110, 48, 196)' },
};
for (const theme of ['dark', 'light']) {
  test(`Now person card and pinned tracker match the mock at 820px, ${theme}`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1400 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&variant=default&width=820&tab=now`);
      await page.waitForSelector('#hx-frame .su-host');
      await page.click('.more2');
      await page.waitForFunction(() => { const e = document.querySelector('.hp2 dt'); return e && getComputedStyle(e).paddingTop === '2px'; });
      const m = await page.evaluate(measure);
      const w = WANT[theme];
      assert.equal(m.star.color, w.star);
      assert.equal(m.ph.fontSize, '22px');
      assert.equal(m.ph.color, 'rgb(255, 255, 255)');
      assert.equal(m.ph.backgroundColor, w.bg);
      assert.equal(m.link.paddingLeft, '6px');
      assert.equal(m.link.paddingRight, '6px');
      assert.equal(m.dt.paddingTop, '2px');
      if (m.wants) assert.equal(m.wants.color, w.wants);
      if (m.fld) {
        assert.equal(m.fld.paddingTop, '4px');
        assert.match(m.fld.gridTemplateColumns, /^76px /);
        assert.equal(m.barH, 7);
      }
    } finally { await page.close(); }
  });
}
