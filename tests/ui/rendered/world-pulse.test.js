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

test('the you-are-here ring animates opacity only (five fixed radii 14 to 30) and an idle World tab lays out almost never', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 1143, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=1143&tab=world`);
  await page.waitForSelector('#hx-frame .mp .you circle.r');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const count = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
  await page.waitForTimeout(300);
  const before = await count();
  await page.waitForTimeout(2000);
  const layouts = (await count()) - before;
  const info = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.mp .you circle.r')];
    const as = document.getAnimations().filter(x => x.animationName === 'wpulse');
    const props = as.flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)));
    return { running: as.length, props: [...new Set(props)].sort(), radii: cs.map(c => c.getAttribute('r')), stroke: getComputedStyle(cs[0]).strokeWidth };
  });
  await page.close();
  assert.equal(info.running, 5, 'the pulse animation is running on all five rings');
  assert.deepEqual(info.props, ['opacity']);
  assert.deepEqual(info.radii, ['14', '18', '22', '26', '30']);
  assert.equal(info.stroke, '3px');
  assert.ok(layouts <= 3, `idle World tab laid out ${layouts} times in 2 s`);
});
