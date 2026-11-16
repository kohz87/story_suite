// Rendered check: Settings at 820 px matches the mock's measured values (header title, module description lines, switch column, close button).
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

async function openSettings(theme, section) {
  const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1000 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=820&tab=now`);
  await page.click('button.ibtn >> visible=true');
  await page.waitForSelector('.shd .ttl small');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.shd .ttl small')).display === 'block');
  if (section !== 'modules') {
    await page.click(`.si3[data-sec=${section}]`);
    await page.waitForSelector('.msubs .srow, .sgrp');
  }
  return page;
}

for (const theme of ['dark', 'light']) {
  test(`settings header and module cards at 820 in ${theme}: 39px title block, 18px description lines, 54px switch column`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openSettings(theme, 'modules');
    const got = await page.evaluate(() => {
      const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { y: r.y, w: r.width, h: r.height }; };
      const head = document.querySelector('.shd').getBoundingClientRect().y;
      const x = document.querySelector('.shd .x');
      const sw = document.querySelector('.mh .sw');
      return {
        ttlH: box('.shd .ttl').h, ttlY: box('.shd .ttl').y - head, xY: box('.shd .x').y - head, xW: box('.shd .x').w, xFont: getComputedStyle(x).fontSize,
        mods: [...document.querySelectorAll('.mod')].map(m => Math.round(m.getBoundingClientRect().height)),
        smallLh: getComputedStyle(document.querySelector('.mod .mt small')).lineHeight,
        swMargin: [getComputedStyle(sw).marginLeft, getComputedStyle(sw).marginRight], swW: sw.getBoundingClientRect().width,
      };
    });
    await page.close();
    assert.equal(got.ttlH, 39);
    assert.equal(got.ttlY, 14.5);
    assert.equal(got.xY, 12);
    assert.equal(got.xW, 44);
    assert.equal(got.xFont, '16px');
    assert.deepEqual(got.mods, [149, 131, 131, 131, 113]);
    assert.equal(got.smallLh, '18px');
    assert.deepEqual(got.swMargin, ['-4px', '-4px']);
    assert.equal(got.swW, 62);
  });

  test(`settings hint rows at 820 in ${theme}: People switch rows are 56px with one-line hints`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openSettings(theme, 'people');
    const rows = await page.evaluate(() => [...document.querySelectorAll('.msubs .srow')].slice(0, 3).map(r => ({
      h: Math.round(r.getBoundingClientRect().height), ctl: r.querySelector('.ctl').getBoundingClientRect().width,
      hint: Math.round(r.querySelector(".lb small").getBoundingClientRect().height),
    })));
    await page.close();
    for (const r of rows) { assert.equal(r.h, 56); assert.equal(r.ctl, 54); assert.equal(r.hint, 16); }
  });
}
