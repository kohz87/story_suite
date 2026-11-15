// Rendered check: drives the dev harness in Chromium at phone, tablet and desktop widths and asserts layout, tap size and font rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const THEMES = ['dark', 'light', 'follow'];
const FIXED = [[360, 740], [390, 844], [820, 1180]];
const TABS = ['now', 'party', 'bag', 'people', 'world', 'journal', 'story'];
const MIN_FONT = 12;

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      if (port > 8799) { reject(new Error('no free port in 8766-8799')); return; }
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve({ server, port }); });
    };
    tryPort(8766);
  });
}

/** Runs in the page: returns every layout problem inside the suite frame. */
function audit({ minTap, fightTap = 48, tapFloor = true }) {
  const frame = document.getElementById('hx-frame');
  const seen = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.right > 0 && r.left < innerWidth; };
  // A control may draw small and own a bigger invisible hit area (an absolutely placed ::after); a finger hits that box.
  const tapBox = (el) => {
    const r = el.getBoundingClientRect();
    const a = getComputedStyle(el, '::after');
    if (a.content === 'none' || a.position !== 'absolute') return r;
    return { width: Math.max(r.width, parseFloat(a.width) || 0), height: Math.max(r.height, parseFloat(a.height) || 0) };
  };
  const label = el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}${el.dataset?.tab ? `[${el.dataset.tab}]` : ''}`;
  const problems = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > innerWidth) problems.push(`x-scroll: page ${doc.scrollWidth} > ${innerWidth}`);
  for (const el of frame.querySelectorAll('*')) {
    if (el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) === false && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && el.closest('svg') === null && seen(el)) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1) problems.push(`overflow: ${label(el)} right ${Math.round(r.right)}`);
    }
  }
  for (const el of frame.querySelectorAll('button, [role=tab], a, [data-tap]')) {
    if (!seen(el)) continue;
    const r = tapBox(el);
    const need = el.closest('.su-panel[data-tab="fight"]') ? fightTap : minTap;
    if (tapFloor && (r.height < need - 0.5 || r.width < need - 0.5)) problems.push(`tap: ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || done.has(el) || !n.textContent.trim() || el.closest('svg') || !seen(el)) continue;
    done.add(el);
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) problems.push(`font: ${label(el)} ${size}px "${n.textContent.trim().slice(0, 20)}"`);
  }
  const bar = frame.querySelector('.su-bar');
  if (bar && seen(bar) && bar.scrollWidth > bar.clientWidth + 1) problems.push(`tab bar overflows: ${bar.scrollWidth} > ${bar.clientWidth}`);
  return problems;
}

let ctx = null;
test.before(async () => {
  let chromium;
  try {
    ({ chromium } = require('/home/raven/story_suite/node_modules/playwright'));
    const browser = await chromium.launch();
    const { server, port } = await serve();
    ctx = { browser, server, port };
  } catch (err) {
    ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
  }
});
test.after(async () => {
  if (ctx?.browser) await ctx.browser.close();
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

async function open(width, height, query) {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  const outside = [];
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1:${ctx.port}/`)) return route.continue();
    outside.push(url);
    return route.abort();
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?${query}`);
  await page.waitForSelector('#hx-frame .su-host');
  return { page, errors, outside };
}

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const theme of THEMES) {
  for (const [width, height] of FIXED) {
    test(`every tab at ${width}x${height} in ${theme}: no x-scroll, taps >= 44, font >= ${MIN_FONT}`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const { page, errors, outside } = await open(width, height, `theme=${theme}&width=${width}`);
      try {
        for (const tab of TABS) {
          await page.evaluate(x => globalThis.storySuiteHarness.apply({ tab: x }), tab);
          await settle(page);
          const problems = await page.evaluate(audit, { minTap: 44 });
          assert.deepEqual(problems, [], `${tab} @${width} ${theme}`);
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(outside, [], 'no request leaves the local server');
      } finally { await page.close(); }
    });
  }
}

test('the 8-tab bar fits at 360 px and the fight tab shows with 48 px taps', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page } = await open(360, 740, 'variant=fightOpen&width=360&tab=fight');
  try {
    await settle(page);
    const count = await page.evaluate(() => document.querySelectorAll('#hx-frame .su-bar-btn').length);
    assert.equal(count, 8);
    const problems = await page.evaluate(audit, { minTap: 44, fightTap: 48 });
    assert.deepEqual(problems, []);
    const fitsBar = await page.evaluate(() => { const b = document.querySelector('#hx-frame .su-bar'); return b.scrollWidth <= b.clientWidth + 1; });
    assert.equal(fitsBar, true);
  } finally { await page.close(); }
});

for (const theme of THEMES) {
  test(`continuous sweep 320-2000 px in 20 px steps in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page } = await open(320, 800, `theme=${theme}&width=320`);
    try {
      const failures = [];
      for (let width = 320; width <= 2000; width += 20) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(w => globalThis.storySuiteHarness.apply({ width: w }), width);
        await settle(page);
        // Below 360 px the 8-tab bar cannot reach 44 px wide taps (plan: the bar fits at 360); other rules still apply.
        const problems = await page.evaluate(audit, { minTap: 44, tapFloor: width >= 360 });
        if (problems.length) failures.push({ width, problems });
      }
      assert.deepEqual(failures, []);
    } finally { await page.close(); }
  });
}
