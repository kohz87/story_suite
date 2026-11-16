// Rendered check: the suite's button reset is one class (.su-root :where(button)): component button rules (tab labels) win over it, and a later bare button rule (another extension, SillyTavern) does not.
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

const INACTIVE = { dark: 'rgb(207, 208, 224)', light: null };

for (const theme of ['dark', 'light']) {
  test(`tab strip labels at 820 in ${theme}: weight 600, soft colour, Nunito 14px`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1000 } });
    await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=820&tab=now`);
    await page.waitForSelector('#hx-frame .su-tab');
    // wait on a value from our CSS: the tab weight must be the component's 600
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.su-tab')).fontWeight === '600');
    const got = await page.evaluate(() => {
      const root = document.querySelector('.su-root');
      const probe = (v) => { const e = document.createElement('i'); e.style.color = `var(${v})`; root.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
      const tabs = [...document.querySelectorAll('.su-tab')];
      const off = tabs.filter(b => b.getAttribute('aria-selected') !== 'true' && b.getAttribute('aria-current') !== 'page' && !b.classList.contains('on'));
      return { soft: probe('--su-soft'), rows: off.map(b => { const c = getComputedStyle(b); return { w: c.fontWeight, s: c.fontSize, f: c.fontFamily, c: c.color }; }) };
    });
    await page.close();
    assert.ok(got.rows.length >= 6);
    if (INACTIVE[theme]) assert.equal(got.soft, INACTIVE[theme]);
    for (const r of got.rows) {
      assert.equal(r.w, '600');
      assert.equal(r.s, '14px');
      assert.match(r.f, /Nunito/);
      assert.equal(r.c, got.soft);
    }
  });
}

test('a bare button rule loaded after the suite (another extension) does not restyle suite buttons', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 820, height: 1000 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=820&tab=now`);
    await page.waitForSelector('#hx-frame .su-tab');
    const got = await page.evaluate(() => {
      const late = document.createElement('style'); late.textContent = 'button{font-family:serif;font-size:30px;color:rgb(255, 0, 0)}'; document.head.appendChild(late);
      const root = document.querySelector('.su-root'); const b = document.createElement('button'); root.appendChild(b);
      const c = getComputedStyle(b); const r = getComputedStyle(root);
      const out = { f: c.fontFamily === r.fontFamily, s: c.fontSize, red: c.color === 'rgb(255, 0, 0)', tab: getComputedStyle(document.querySelector('.su-tab')).fontWeight };
      b.remove(); late.remove(); return out;
    });
    assert.deepEqual(got, { f: true, s: '14px', red: false, tab: '600' });
  } finally { await page.close(); }
});
