// Rendered check: the Journal tab keeps the approved mock's fixed values (links, due chips, calendar numbers, lapse line, quest editor close).
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

/** Reads computed values of the first match of each selector inside the harness frame. */
const read = (page, sels) => page.evaluate(map => Object.fromEntries(Object.entries(map).map(([k, s]) => {
  const e = document.querySelector(`#hx-frame ${s}`);
  if (!e) return [k, null];
  const c = getComputedStyle(e); const r = e.getBoundingClientRect();
  return [k, { h: Math.round(r.height * 10) / 10, pad: c.paddingLeft, size: c.fontSize, weight: c.fontWeight, bg: c.backgroundColor }];
})), sels);

for (const theme of ['dark', 'light']) {
  for (const width of [390, 820]) {
    test(`journal matches the mock at ${width} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 1100 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=journal`);
        await page.waitForSelector('#hx-frame .journal-tab .qkv');
        await page.evaluate(() => document.fonts.ready);
        const q = await read(page, { lk: '.journal-tab .lk', fstar: '.fstar', soon: '.qkv .due.soon', late: '.qkv .due.late', lapse: '.lapse' });
        assert.equal(q.lk.h, 19.5, 'link is a text line, not a 44 px box');
        assert.equal(q.lk.pad, '0px');
        assert.equal((await read(page, { g: '.lk-plain' })).g?.h ?? 19.5, 19.5, 'plain giver is a 19.5 px line');
        assert.equal(q.fstar.pad, '0px');
        assert.equal(q.soon.bg, 'rgba(242, 180, 90, 0.16)');
        assert.equal(q.late.bg, 'rgba(229, 72, 77, 0.14)');
        assert.equal(q.lapse.size, '12px');
        assert.equal((await read(page, { s: '.lead2 small:not(.lapse)' })).s.size, '12px', 'lead sub-line is 12 px');
        await page.evaluate(() => document.querySelector('#hx-frame [data-value="cal"]').click());
        await page.waitForSelector('#hx-frame .cd b');
        const day = await read(page, { n: '.cd:not(.pre) b', t: '.cd.today b' });
        assert.equal(day.n.size, width >= 620 ? '15px' : '14px', 'day number 14 px narrow, 15 px at the 620 container');
        assert.equal(day.t.size, day.n.size);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hx-frame .dsec .secl')).marginBottom), '2px', 'day-panel label margin');
        assert.equal((await read(page, { t: '.cd.today' })).t.h, 44, 'calendar cell is 44 px tall at every width');
        const dl2 = await read(page, { r: '.dl2:has(small.wrap)' });
        if (dl2.r) assert.equal(dl2.r.h, 84.3, 'planned row matches the mock quirks-mode height');
        assert.equal((await read(page, { u: '.up' })).u.h, 56, 'coming-up row is 56 px tall');
        await page.evaluate(() => document.querySelector('#hx-frame [data-value="quests"]')?.click());
        await page.waitForSelector('#hx-frame .qedit');
        await page.evaluate(() => document.querySelector('#hx-frame .qedit').click());
        await page.waitForSelector('.qeh .x');
        const x = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.qeh .x')); return [c.fontSize, c.fontWeight, c.borderRadius]; });
        assert.deepEqual(x, ['16px', '800', '10px']);
        const sheet = await page.evaluate(() => ({ gap: getComputedStyle(document.querySelector('.qsheet')).rowGap, x: document.querySelector('.qeh .qclose').textContent, more: document.querySelector('.qeh .qmore-btn').textContent }));
        assert.equal(sheet.gap, '12px', 'quest sheet field gap');
        assert.equal(sheet.x, '×');
        assert.equal(sheet.more, '⋯');
        const pitch = await page.evaluate(() => { const f = [...document.querySelectorAll('.qsheet .ef')]; return f[1].getBoundingClientRect().y - f[0].getBoundingClientRect().y; });
        assert.equal(pitch, 76, 'field row pitch matches the mock');
      } finally { await page.close(); }
    });
  }
}
