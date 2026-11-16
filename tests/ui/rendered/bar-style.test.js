// Rendered check: the phone bottom bar and mini buttons keep the mock's type and colours, so a .su-root button override cannot win again.
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

/** Runs in the page: reads the computed bar and mini button styles next to the tokens they must equal. */
function read() {
  const frame = document.getElementById('hx-frame');
  const root = frame.querySelector('.su-root') ?? frame;
  const token = (name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    root.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  };
  const css = (el) => getComputedStyle(el);
  const labelOf = (btn) => css(btn.querySelector('.su-bar-label'));
  const bar = [...frame.querySelectorAll('.su-bar-btn')];
  const inactive = bar.find((b) => b.getAttribute('aria-current') !== 'true');
  const active = bar.find((b) => b.getAttribute('aria-current') === 'true');
  const mini = [...frame.querySelectorAll('.su-mini-btn')];
  return {
    muted: token('--su-muted'),
    accent: token('--su-accent'),
    inactive: { weight: labelOf(inactive).fontWeight, colour: labelOf(inactive).color, btnColour: css(inactive).color },
    active: { weight: labelOf(active).fontWeight, colour: labelOf(active).color, btnColour: css(active).color },
    mini: mini.map((b) => ({ size: css(b).fontSize, weight: css(b).fontWeight })),
  };
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
  if (ctx?.server) await new Promise((done) => ctx.server.close(done));
});

for (const theme of ['dark', 'light']) {
  test(`phone bar labels and mini buttons match the mock in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&tab=now`);
      await page.waitForSelector('#hx-frame .su-host');
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const s = await page.evaluate(read);
      assert.equal(s.inactive.weight, '600');
      assert.equal(s.inactive.colour, s.muted);
      assert.equal(s.inactive.btnColour, s.muted);
      assert.equal(s.active.weight, '600');
      assert.equal(s.active.colour, s.accent);
      assert.equal(s.active.btnColour, s.accent);
      assert.notEqual(s.muted, s.accent);
      assert.equal(s.mini.length, 2);
      for (const m of s.mini) assert.deepEqual(m, { size: '13px', weight: '800' });
    } finally { await page.close(); }
  });
}
