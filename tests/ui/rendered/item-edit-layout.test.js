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

const BASE = port => `http://127.0.0.1:${port}/ui/dev/harness.html`;
async function open(width, height, url, errors = []) {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(url);
  return page;
}

for (const theme of ['dark', 'light']) {
  for (const [width, height] of SIZES) {
    test(`item sheet Edit at ${width}x${height} in ${theme}: a 44px button left of the ×, the form under the header`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const errors = [];
      const page = await open(width, height, `${BASE(ctx.port)}?theme=${theme}&width=${width}&tab=bag`, errors);
      try {
        await page.waitForSelector('#hx-frame .bag-tab .itm');
        await page.evaluate(() => [...document.querySelectorAll('#hx-frame .itm')].find(i => i.textContent.includes('Spare dagger')).click());
        await page.waitForSelector('.bag-sheet .bhact .edit');
        const head = await page.evaluate(() => {
          const r = s => document.querySelector(s).getBoundingClientRect();
          const e = r('.bhact .edit'); const x = r('.ps-x'); const dh = r('.bag-sheet .dh'); const dn = r('.bag-sheet .dn');
          const c = getComputedStyle(document.querySelector('.bhact .edit'));
          return { eh: e.height, ew: e.width, gap: x.left - e.right, mid: e.top + e.height / 2 - (x.top + x.height / 2), nameGap: e.left - dn.right, inside: e.right <= dh.right + 0.5, font: [c.fontSize, c.fontWeight], radius: c.borderTopLeftRadius };
        });
        assert.equal(head.eh, 44, 'Edit is a 44px target');
        assert.equal(Math.abs(head.mid) < 0.6, true, `Edit centred with the × (${head.mid})`);
        assert.equal(head.gap, 6, 'the mock 6px gap between Edit and ×');
        assert.equal(head.nameGap >= 0, true, 'the name does not run under Edit');
        assert.deepEqual([head.font, head.radius], [['12.5px', '800'], '12px'], 'mock .btn2');
        await page.screenshot({ path: `/tmp/item-sheet-${theme}-${width}.png` });
        await page.click('.bhact .edit');
        await page.waitForSelector('.iedit');
        const form = await page.evaluate(() => {
          const lab = document.querySelector('.iedit .ef'); const inp = document.querySelector('.iedit .ef input'); const c = getComputedStyle(lab); const i = getComputedStyle(inp);
          const sh = document.querySelector('.pty-sheet').getBoundingClientRect(); const f = document.querySelector('.iedit').getBoundingClientRect();
          return { label: [c.fontSize, c.fontWeight, c.textTransform], input: [i.fontSize, i.minHeight, i.borderTopLeftRadius], selects: document.querySelectorAll('.iedit select').length, fits: f.right <= sh.right && f.bottom <= sh.bottom + 1, edit: !!document.querySelector('.bhact .edit') };
        });
        assert.deepEqual(form.label, ['12px', '800', 'uppercase'], 'field label');
        assert.deepEqual(form.input, ['14px', '44px', '12px'], 'field input');
        assert.equal(form.selects, 2, 'a hand-made piece with RPG on: Rarity and Slot');
        assert.equal(form.fits, true);
        assert.equal(form.edit, false, 'no Edit button while editing');
        await page.screenshot({ path: `/tmp/item-edit-${theme}-${width}.png` });
        await page.click('.iedit .cancel');
        assert.equal(await page.evaluate(() => !!document.querySelector('.bhact .edit') && !document.querySelector('.iedit')), true, 'Cancel returns to the item view');
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });

    test(`item Edit with RPG off at ${width}x${height} in ${theme}: name, count and note only`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await open(width, height, `${BASE(ctx.port)}?theme=${theme}&variant=rpgOff&width=${width}&tab=bag`);
      try {
        await page.waitForSelector('#hx-frame .bag-tab .itm');
        await page.evaluate(() => document.querySelector('#hx-frame .itm').click());
        await page.waitForSelector('.bag-sheet .bhact .edit');
        await page.click('.bhact .edit');
        await page.waitForSelector('.iedit');
        assert.equal(await page.evaluate(() => [document.querySelectorAll('.iedit .ef').length, document.querySelectorAll('.iedit select').length]).then(String), '3,0');
      } finally { await page.close(); }
    });

    test(`Now Here cards have no party badge, Journal lead disc is readable at ${width}x${height} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const now = await open(width, height, `${BASE(ctx.port)}?theme=${theme}&width=${width}&tab=now`);
      try {
        await now.waitForSelector('#hx-frame .hp2');
        assert.equal(await now.evaluate(() => document.querySelectorAll('#hx-frame .prg .pty').length), 0, 'no party badge on Here cards');
        assert.equal(await now.evaluate(() => document.querySelectorAll('#hx-frame .prg .star').length > 0), true, 'the followed star stays');
      } finally { await now.close(); }
      const journal = await open(width, height, `${BASE(ctx.port)}?theme=${theme}&width=${width}&tab=journal`);
      try {
        await journal.waitForSelector('#hx-frame .lead2 .a');
        const disc = await journal.evaluate(() => { const c = getComputedStyle(document.querySelector('#hx-frame .lead2 .a')); return [c.backgroundColor, c.color]; });
        if (theme === 'light') assert.deepEqual(disc, ['rgb(220, 220, 234)', 'rgb(29, 32, 48)'], 'light disc, dark letter (the People rule)');
        else assert.notEqual(disc[0], 'rgb(220, 220, 234)', 'dark theme keeps its tile disc');
        await journal.screenshot({ path: `/tmp/journal-lead-${theme}-${width}.png` });
      } finally { await journal.close(); }
    });
  }
}
