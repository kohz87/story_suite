// Rendered check: the dossier on a desktop window. With one layout at every width it covers the whole suite (card, strip and tab under it), the ⋯ menu drops from
// its button, and Mood | Right now pair once the dossier's content is 1,000 px wide (reached in the 1,280 px floating window).
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


/** Runs in the page: the dossier's boxes against the suite root. */
function measure() {
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), b: Math.round(r.bottom) }; };
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const mood = q('.dov .dcard[data-page="mood"]'), now = q('.dov .dcard[data-page="now"]');
  return {
    dov: box(q('.dov')), root: box(q('.su-root')), cls: q('.dov').className,
    paired: Boolean(mood && now && Math.abs(mood.getBoundingClientRect().top - now.getBoundingClientRect().top) < 1),
    ties: Math.abs(q('.dov .dcard[data-page="ties"]').getBoundingClientRect().top - q('.dov .dcard[data-page="past"]').getBoundingClientRect().top) < 1,
  };
}

for (const width of [1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`dossier at ${width} ${theme}: covers the whole suite, Mood and Right now side by side, Ties and Past side by side`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await openDossier(width, width === 1280 ? 800 : 1080, theme);
      try {
        const m = await page.evaluate(measure);
        assert.doesNotMatch(m.cls, /\bddesk\b/);
        assert.deepEqual([m.dov.x, m.dov.y, m.dov.w], [m.root.x, m.root.y, m.root.w], 'the dossier covers the suite');
        assert.equal(m.paired, true, 'the 1,280 px window is wide enough for Mood | Right now');
        assert.equal(m.ties, true, 'Ties | Past side by side');
      } finally { await page.close(); }
    });
  }

  test(`dossier ⋯ menu at ${width}: drops from its button, just under the top bar`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openDossier(width, width === 1280 ? 800 : 1080);
    try {
      await page.evaluate(() => document.querySelector('#hx-frame .dossier [data-act="menu"]').click());
      await settle(page);
      const m = await page.evaluate(() => {
        const r = s => document.querySelector(`#hx-frame ${s}`).getBoundingClientRect();
        return { menu: r('.dossier .menu'), btn: r('.dossier [data-act="menu"]') };
      });
      assert.ok(m.menu.right <= m.btn.right + 12 && m.menu.right >= m.btn.right, `menu right ${m.menu.right} by the button ${m.btn.right}`);
      assert.ok(m.menu.top >= m.btn.bottom - 1 && m.menu.top <= m.btn.bottom + 16, `menu top ${m.menu.top} under the button ${m.btn.bottom}`);
    } finally { await page.close(); }
  });
}
