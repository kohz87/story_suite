// Rendered check: the Settings phone list at 390 px keeps the mock's row pitch and label spacing, and every section's "applies" note keeps its 4px top margin.
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

async function openSettings(theme, width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=now`);
  await page.evaluate(() => document.fonts.ready);
  await page.click('button.ibtn >> visible=true');
  await page.waitForSelector('.shd .ttl small');
  return page;
}

for (const theme of ['dark', 'light']) {
  test(`settings phone list at 390 in ${theme}: 18px description lines, 14px label spacing, the mock's row pitch`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openSettings(theme, 390);
    try {
      await page.waitForSelector('.phonelist .slist button');
      const got = await page.evaluate(() => {
        const top = e => e.getBoundingClientRect().top;
        const rows = Object.fromEntries([...document.querySelectorAll('.phonelist .slist button')].map(b => [b.dataset.sec, b]));
        const label = name => [...document.querySelectorAll('.phonelist .secl2')].find(l => l.textContent.trim().toLowerCase() === name);
        const small = getComputedStyle(rows.start.querySelector('small'));
        const b = id => top(rows[id].querySelector('b'));
        return {
          small: [small.display, small.lineHeight], gap: getComputedStyle(document.querySelector('.phonelist')).rowGap,
          twoLine: b('look') - b('start'), oneLine: b('director') - b('world'), labelToRow: [b('start') - top(label('play')), b('people') - top(label('rules'))],
          descH: [rows.start, rows.world].map(r => r.querySelector('small').getBoundingClientRect().height),
        };
      });
      assert.deepEqual(got.small, ['block', '18px'], 'descriptions lay out in their own 18px lines');
      assert.equal(got.gap, '14px', 'search, labels and lists 14px apart, as in the mock .smain');
      assert.equal(got.twoLine, 84, 'a row with a two-line description');
      assert.equal(got.oneLine, 66, 'a row with a one-line description');
      assert.deepEqual(got.labelToRow, [39, 39], 'group label to its first row');
      assert.deepEqual(got.descH, [36, 18]);
    } finally { await page.close(); }
  });

  for (const width of [390, 820]) {
    test(`settings "applies" note keeps its 4px top margin at ${width} in ${theme}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await openSettings(theme, width);
      try {
        await page.click(width < 600 ? '.phonelist [data-sec=people]' : '.si3[data-sec=people]');
        await page.waitForSelector('.spage .applies');
        const got = await page.evaluate(() => {
          const a = [...document.querySelectorAll('.spage .applies')].find(e => e.getBoundingClientRect().height > 0);
          return { margin: getComputedStyle(a).marginTop, step: a.getBoundingClientRect().top - a.previousElementSibling.getBoundingClientRect().bottom };
        });
        assert.deepEqual(got, { margin: '4px', step: 4 });
      } finally { await page.close(); }
    });
  }
}
