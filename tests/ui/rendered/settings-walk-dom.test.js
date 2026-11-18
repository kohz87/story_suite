// Rendered check: the settings walk's page readers (scripts/ui-walk/walk-dom.mjs) find and read the real Settings controls in the harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listControls, readValues, lookPrint } from '../../../scripts/ui-walk/walk-dom.mjs';

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

async function openAt(section) {
  const page = await ctx.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=1280&tab=now`);
  await page.click('button.ibtn >> visible=true');
  await page.waitForSelector('.sov:not([hidden]) .snav');
  await page.click(`.sov:not([hidden]) .snav [data-sec="${section}"]`);
  await page.waitForSelector('.sov:not([hidden]) .spage h2');
  return page;
}

test('listControls tags the Look page: each row by its key with its kind, the reset as an action', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await openAt('look');
  const list = await page.evaluate(listControls);
  const byId = Object.fromEntries(list.map(c => [c.id, c]));
  const rows = await page.evaluate(() => [...document.querySelectorAll('.sov:not([hidden]) .spage .srow[data-key]')].map(r => [r.dataset.key, r.dataset.type]));
  assert.ok(rows.length >= 4);
  const KIND = { sw: 'sw', seg: 'seg', sel: 'sel', num: 'num', txt: 'txt', chips: 'chips' };
  for (const [key, type] of rows) assert.equal(byId[key]?.kind, KIND[type], `row ${key} (${type})`);
  assert.ok(list.some(c => c.kind === 'seg' && c.options.length >= 2), 'a choice with its options');
  assert.equal(byId['look.panelBg']?.kind, 'sw');
  assert.ok(list.some(c => c.kind === 'act' && /^Reset Look/.test(c.label)), 'the reset button is listed as an action');
  assert.ok(list.every(c => c.visible), 'every Look control is drawn');
  assert.equal(await page.locator('.sov:not([hidden]) .spage [data-walk-id]').count(), list.length);
  await page.close();
});

test('readValues follows a click: a switch reads its new state and a choice its pressed option', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await openAt('look');
  const list = await page.evaluate(listControls);
  const before = await page.evaluate(readValues);
  assert.equal(typeof before['look.panelBg'], 'boolean');
  const seg = list.find(c => c.kind === 'seg');
  assert.ok(seg.options.includes(before[seg.id]), `${seg.id} reads one of its options`);
  await page.click('.sov:not([hidden]) [data-walk-id="look.panelBg"]');
  const after = await page.evaluate(readValues);
  assert.equal(after['look.panelBg'], !before['look.panelBg']);
  const print = JSON.parse(await page.evaluate(lookPrint));
  assert.equal(print.attrs['data-panelbg'], after['look.panelBg'] ? 'on' : 'off');
  await page.close();
});

test('module cards on Start are listed by module and feature, with their links as actions', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await openAt('start');
  const more = page.locator('.sov:not([hidden]) .spage button.lnk', { hasText: /^Features/ });
  for (let i = 0; i < 8 && await more.count(); i += 1) await more.first().click();
  const list = await page.evaluate(listControls);
  assert.ok(list.some(c => c.id.startsWith('mod:') && c.kind === 'sw'), 'a module switch');
  assert.ok(list.some(c => /^sub:[^:]+:.+/.test(c.id) && c.kind === 'sw'), 'a feature switch');
  assert.ok(list.some(c => c.kind === 'act' && /^Settings ›/.test(c.label)), 'the card link is an action');
  await page.close();
});
