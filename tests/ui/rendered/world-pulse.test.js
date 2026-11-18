// Rendered check: the World map's "you are here" ring pulses with transform and opacity only, so an idle World tab does no layout per frame.
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

test('the you-are-here ring is the mock pulse (one ring, scale to full, opacity 1 to 0, 2 s) on transform + opacity, sits on the place, and an idle World tab lays out almost never', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 1143, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=1143&tab=world`);
  await page.waitForSelector('#hx-frame .mapbox .pulse');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const count = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
  await page.waitForTimeout(300);
  const before = await count();
  await page.waitForTimeout(2000);
  const layouts = (await count()) - before;
  const info = await page.evaluate(() => {
    const ring = document.querySelector('.mapbox .pulse');
    const as = document.getAnimations().filter(x => x.animationName === 'wpulse');
    const kf = as[0].effect.getKeyframes();
    const props = [...new Set(kf.flatMap(k => Object.keys(k)).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)))].sort();
    const dot = document.querySelector('.mapbox .pl.sel circle.b, .mapbox [data-pl] circle.b');
    const here = document.querySelector('.mapbox .mp');
    const r = ring.getBoundingClientRect();
    return { running: as.length, rings: document.querySelectorAll('.mapbox .pulse').length, props, first: kf[0], last: kf.at(-1), timing: as[0].effect.getComputedTiming().duration, svgAnim: !!here.querySelector('animate, animateTransform'), stroke: getComputedStyle(ring).borderTopWidth, w: ring.offsetWidth, hasDot: !!dot, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  await page.close();
  assert.equal(info.running, 1);
  assert.equal(info.rings, 1);
  assert.deepEqual(info.props, ['opacity', 'transform']);
  assert.equal(info.first.opacity, '1');
  assert.equal(info.last.opacity, '0');
  assert.match(info.first.transform, /scale\(0\.483/);
  assert.equal(info.last.transform, 'scale(1)');
  assert.equal(info.timing, 2000);
  assert.equal(info.svgAnim, false);
  assert.ok(info.w > 0 && parseFloat(info.stroke) > 0);
  assert.ok(layouts <= 3, `idle World tab laid out ${layouts} times in 2 s`);
});
