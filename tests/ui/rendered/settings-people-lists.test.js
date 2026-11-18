// Rendered check: Settings › People's list editors under a real mouse and keyboard in the harness (a fake port that keeps what a list
// save stores, as the live port does): typing then clicking another field or Remove keeps the focus and both changes; a card title folds.
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

async function openPeople(width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=${width}&tab=now`);
  await page.waitForFunction(() => globalThis.storySuiteHarness?.port);
  await page.evaluate(() => {
    const port = globalThis.storySuiteHarness.port;
    const view = port.view.bind(port);
    const command = port.command.bind(port);
    globalThis.kept = {};
    port.view = (name, args) => { const v = view(name, args); if (name === 'settings' && v) for (const r of v.sections.find(x => x.id === 'people').rows) if (r.list && globalThis.kept[r.key]) r.list = { ...r.list, items: globalThis.kept[r.key] }; return v; };
    port.command = (type, payload) => (type === 'settings.set' && /^people\./.test(payload?.key) && Array.isArray(payload.value) ? Promise.resolve((globalThis.kept[payload.key] = payload.value, { ok: true })) : command(type, payload));
  });
  await page.click('button.ibtn >> visible=true');
  await page.click('[data-sec=people] >> visible=true');
  await page.waitForSelector('.srow[data-key="people.customMeters"]');
  return page;
}

for (const width of [390, 1280]) {
  test(`People list editors at ${width}: typing then a click on another field or on Remove keeps the focus and both changes`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await openPeople(width);
    const ed = s => page.locator(`[data-edit="people.customMeters"] ${s}`);
    await page.click('.srow[data-key="people.customMeters"] button');
    await page.click('.srow[data-key="people.customMeters"] button');
    await ed('[data-f="0.name"]').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Fear');
    await ed('[data-f="0.min"]').click();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.f), '0.min', 'the clicked field has the focus');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('5');
    await ed('.erow[data-i="1"] > .btn2').click();
    await page.waitForFunction(() => globalThis.kept['people.customMeters']?.length === 1);
    assert.deepEqual(await page.evaluate(() => globalThis.kept['people.customMeters'].map(m => [m.name, m.min])), [['Fear', 5]]);
    await ed('[data-f="0.max"]').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('40');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.f), '0.start', 'Tab moves on to the next field');
    const title = page.locator('.sgrp > .gt', { hasText: 'Portraits' });
    await title.focus();
    await page.keyboard.press('Enter');
    assert.equal(await title.getAttribute('aria-expanded'), 'false', 'Enter on a card title folds it');
    await page.close();
  });
}
