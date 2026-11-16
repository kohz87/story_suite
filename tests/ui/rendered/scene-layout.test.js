// Rendered check: the Scene tab in the dev harness at 390, 1143, 1280 and 1920, dark and light: frame as the Fight header, no sideways scroll, tap-size buttons.
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

/** Runs in the page: the Scene tab's computed values. */
function measure() {
  const q = s => document.querySelector(`#hx-frame ${s}`);
  const box = e => e.getBoundingClientRect();
  const panel = q('.su-panel'), tab = q('.scene-tab'), head = q('.scene-head');
  const choices = [...document.querySelectorAll('#hx-frame .scene-choice-list button')];
  const cs = (e, k) => getComputedStyle(e)[k];
  return {
    tabs: [...document.querySelectorAll('#hx-frame .su-strip .su-tab')].map(t => t.dataset.tab),
    headPad: cs(head, 'padding'),
    headFont: cs(q('.scene-head .t b'), 'fontSize') + ' ' + cs(q('.scene-head .t b'), 'fontWeight'),
    pill: cs(q('.scene-pill'), 'color'),
    pillFont: cs(q('.scene-pill'), 'fontSize'),
    sideways: tab.scrollWidth > tab.clientWidth + 1,
    overflowRight: Math.max(...[...tab.querySelectorAll('*')].map(e => box(e).right)) > box(tab).right + 1,
    minChoice: Math.min(...choices.map(b => Math.round(box(b).height))),
    choices: choices.length,
    cols: new Set(choices.map(b => Math.round(box(b).left))).size,
    glass: cs(head, 'backgroundColor') !== 'rgba(0, 0, 0, 0)',
  };
}

const PILL = { dark: 'rgb(79, 211, 154)', light: 'rgb(11, 110, 69)' };

for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`scene tab at ${width} in ${theme}: Fight-header frame, tap-size choices, nothing sideways`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&scene=staged&long=1&tab=scene`);
        await page.waitForSelector('#hx-frame .scene-tab .scene-choice-list button');
        await page.waitForFunction(c => getComputedStyle(document.querySelector('#hx-frame .scene-pill')).color === c, PILL[theme]);
        const m = await page.evaluate(measure);
        assert.deepEqual(m.tabs.slice(-2), ['story', 'scene']);
        assert.equal(m.headPad, '12px 14px');
        assert.equal(m.headFont, '16px 800');
        assert.equal(m.pillFont, '12px');
        assert.equal(m.pill, PILL[theme]);
        assert.equal(m.sideways, false);
        assert.equal(m.overflowRight, false);
        assert.ok(m.minChoice >= 48, `choice height ${m.minChoice}`);
        assert.equal(m.choices, 8);
        assert.ok(width > 700 ? m.cols >= 2 : m.cols === 1, `columns at ${width}: ${m.cols}`);
      } finally { await page.close(); }
    });
  }
}

test('scene tab absent from the harness by default', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=390`);
    await page.waitForSelector('#hx-frame .su-strip .su-tab', { state: 'attached' });
    assert.equal(await page.locator('#hx-frame .su-tab[data-tab="scene"]').count(), 0);
  } finally { await page.close(); }
});
