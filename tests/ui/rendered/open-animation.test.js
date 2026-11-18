// Rendered check: the suite view opens in place (fade + slight scale) on desktop, slides from the edge on phone and tablet, and never animates with reduced motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/ui/css/shell.css"></head><body>
<script type="module">
import { createSuiteView } from '/ui/shell/suite-view.js';
window.view = createSuiteView({});
</script></body></html>`;

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const file = path.join(ROOT, decodeURIComponent(url));
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

async function mount(width, reducedMotion = 'no-preference') {
  const page = await ctx.browser.newPage({ viewport: { width, height: 800 }, reducedMotion });
  await page.goto(`http://127.0.0.1:${ctx.port}/page.html`);
  await page.waitForFunction(() => window.view);
  return page;
}

/** Opens the view, then pauses the running root animations half way and reports the computed transform, opacity and which properties transition. */
const openAndSample = page => page.evaluate(() => {
  const root = document.querySelector('.su-root');
  window.view.open();
  const anims = root.getAnimations();
  const props = anims.map(a => a.transitionProperty).sort();
  anims.forEach(a => { a.pause(); a.currentTime = 90; });
  const m = new DOMMatrixReadOnly(getComputedStyle(root).transform);
  return { props, tx: m.e, scale: m.a, opacity: Number(getComputedStyle(root).opacity) };
});

test('desktop 1280: the suite opens in place with a fade and a slight scale, no slide', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await mount(1280);
  try {
    const s = await openAndSample(page);
    assert.deepEqual(s.props, ['opacity', 'transform']);
    assert.equal(s.tx, 0, 'no translateX at any point of the open');
    assert.ok(s.scale > 0.97 && s.scale < 1, `scale ${s.scale} is between the start and 1`);
    assert.ok(s.opacity > 0 && s.opacity < 1, `opacity ${s.opacity} is mid fade`);
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.su-root')).transitionDuration);
    assert.equal(dur, '0.18s, 0.18s');
  } finally { await page.close(); }
});

test('desktop 1280: closing runs the same fade reversed, still in place', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await mount(1280);
  try {
    await page.evaluate(() => { window.view.open(); document.getAnimations().forEach(a => a.finish()); });
    const s = await page.evaluate(() => {
      const root = document.querySelector('.su-root');
      window.view.close();
      const anims = root.getAnimations();
      anims.forEach(a => { a.pause(); a.currentTime = 90; });
      return { n: anims.length, tx: new DOMMatrixReadOnly(getComputedStyle(root).transform).e, opacity: Number(getComputedStyle(root).opacity) };
    });
    assert.equal(s.n, 2);
    assert.equal(s.tx, 0);
    assert.ok(s.opacity > 0 && s.opacity < 1);
  } finally { await page.close(); }
});

for (const width of [390, 820]) {
  test(`${width} (phone / tablet): the edge slide is kept`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await mount(width);
    try {
      const s = await openAndSample(page);
      assert.deepEqual(s.props, ['transform']);
      assert.ok(s.tx > 0 && s.tx < width, `translateX ${s.tx} is part way in`);
      assert.equal(s.opacity, 1);
    } finally { await page.close(); }
  });
}

for (const width of [390, 1280]) {
  test(`reduced motion at ${width}: no transition, the suite is there at once`, async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await mount(width, 'reduce');
    try {
      const s = await page.evaluate(() => {
        const root = document.querySelector('.su-root');
        window.view.open();
        const open = { n: document.getAnimations().length, tx: new DOMMatrixReadOnly(getComputedStyle(root).transform).e, opacity: getComputedStyle(root).opacity };
        window.view.close();
        return { open, closedAnims: document.getAnimations().length, layer: getComputedStyle(document.querySelector('.su-layer')).visibility };
      });
      assert.equal(s.open.n, 0);
      assert.equal(s.open.tx, 0);
      assert.equal(s.open.opacity, '1');
      assert.equal(s.closedAnims, 0);
      assert.equal(s.layer, 'hidden', 'closed at once, no delayed visibility');
    } finally { await page.close(); }
  });
}

test('resizing across the breakpoint while open replays no animation', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await mount(1280);
  try {
    await page.evaluate(() => { window.view.open(); document.getAnimations().forEach(a => a.finish()); });
    for (const width of [600, 1280, 390, 1100]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const s = await page.evaluate(() => ({ n: document.querySelector('.su-root').getAnimations().length, tx: new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.su-root')).transform).e, opacity: getComputedStyle(document.querySelector('.su-root')).opacity }));
      assert.deepEqual(s, { n: 0, tx: 0, opacity: '1' }, `at ${width}`);
    }
  } finally { await page.close(); }
});
