// Rendered check of the Pack Studio page (studio/index.html) in a real browser: the whole packs/validate import graph loads, a pack
// zip opens and is checked, every part has a page, Problems and Go to reach the record, search, the keys, Export gives back the same
// zip, and the phone list → page → back; at 390, 1143, 1280 and 1920, dark and light, nothing runs sideways.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const ZIP = path.join(ROOT, 'examples/packs/ersveil.zip');
const WORLD = path.join(ROOT, 'tests/packs/studio/fixtures/world-mini.json');

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

async function studio(width, { theme = 'dark' } = {}) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  return { page, errors };
}

async function openFile(page, file) {
  await page.setInputFiles('.st-file', file);
  await page.waitForSelector('.st-foot:not([hidden])');
}

const sideways = page => page.evaluate(() => {
  const app = document.querySelector('.st-app').getBoundingClientRect();
  return [...document.querySelectorAll('.st-app *')].filter(el => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && el.closest('.st-json') === null && (box.right > app.right + 1 || box.left < app.left - 1);
  }).map(el => el.className || el.tagName).slice(0, 5);
});

test('Ersveil opens, the checker takes it, every part has a page and Export gives back the same zip', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280);
  try {
    await openFile(page, ZIP);
    const head = await page.evaluate(() => ({
      sub: document.querySelector('.shd .ttl small').textContent,
      foot: document.querySelector('.st-foot .v').textContent,
      nav: [...document.querySelectorAll('.snav .si3')].map(b => b.dataset.part),
      current: document.querySelector('.snav .si3[aria-current="true"]').dataset.part,
      title: document.querySelector('.spage h2').textContent,
      check: document.querySelector('.st-check').dataset.ok,
    }));
    assert.deepEqual(head, { sub: 'Ersveil (open world) · 3.0.0', foot: 'No problems', nav: ['overview', 'other', 'cast', 'map', 'events', 'items', 'problems'], current: 'overview', title: 'Overview', check: 'true' });
    for (const part of head.nav) {
      await page.click(`.snav .si3[data-part="${part}"]`);
      const seen = await page.evaluate(() => ({ title: document.querySelector('.spage h2').textContent, cards: document.querySelectorAll('.spage .sgrp').length }));
      assert.ok(seen.cards > 0, `${part} draws something`);
    }
    await page.click('.snav .si3[data-part="cast"]');
    assert.equal(await page.locator('.spage .st-rec[data-rec^="cast."]').count(), 12);
    assert.equal(await page.locator('.spage img.st-thumb').count(), 12);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('.st-zip')]);
    assert.equal(download.suggestedFilename(), 'ersveil-3.0.0.zip');
    assert.deepEqual(fs.readFileSync(await download.path()), fs.readFileSync(ZIP));
    assert.match(await page.textContent('.st-note'), /Exported ersveil-3\.0\.0\.zip\./);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('a world pack: the checker refuses what main does not know yet; Problems lists it by part and Go to reaches the record', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1143);
  try {
    await openFile(page, WORLD);
    assert.match(await page.textContent('.st-foot .v'), /^\d+ problems$/);
    await page.click('.st-foot');
    const groups = await page.evaluate(() => [...document.querySelectorAll('.st-probs')].map(g => g.dataset.part));
    assert.ok(['lore', 'cast', 'map', 'events'].every(part => groups.includes(part)), groups.join());
    await page.locator('.st-probs[data-part="cast"] .lnk').first().click();
    const hit = await page.evaluate(() => ({ part: document.querySelector('.snav .si3[aria-current="true"]').dataset.part, focused: document.activeElement?.dataset?.rec, marked: document.querySelector('.st-hit')?.dataset.rec }));
    assert.deepEqual(hit, { part: 'cast', focused: 'cast.0', marked: 'cast.0' });
    await page.click('.snav .si3[data-part="lore"]');
    const lore = await page.evaluate(() => [...document.querySelectorAll('.st-rec[data-rec^="lore."]')].map(card => [card.querySelector('.st-rt b').textContent, [...card.querySelectorAll('.tg2')].map(tag => tag.textContent).join(' ')]));
    assert.deepEqual(lore, [['The Lamp Road', 'protected'], ['The Drowned Bell', 'hidden']]);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('search finds a record and opens it; the keys: / search, Alt+digit a part, F8 the next problem, Esc clears the search, Ctrl+O opens, Ctrl+S exports', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280);
  try {
    await openFile(page, WORLD);
    await page.keyboard.press('/');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('psrch')), true);
    await page.keyboard.type('bell');
    assert.equal(await page.textContent('.spage h2'), 'Search');
    assert.deepEqual(await page.$$eval('.hitrow b', bs => bs.map(b => b.textContent)), ['The Drowned Bell']);
    await page.keyboard.press('Escape');
    assert.equal(await page.inputValue('.snav .psrch'), '');
    await page.fill('.snav .psrch', 'bell');
    await page.click('.hitrow');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.rec), 'lore.1');
    await page.keyboard.press('Alt+3');
    assert.equal(await page.textContent('.spage h2'), 'Cast');
    await page.keyboard.press('F8');
    assert.equal(await page.textContent('.spage h2'), 'Lore');
    await page.keyboard.press('F8');
    assert.equal(await page.textContent('.spage h2'), 'Places & routes');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Control+o')]);
    assert.equal(chooser.isMultiple(), true);
    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
    assert.equal(download.suggestedFilename(), 'studio-world-mini-0.1.0.zip');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('phone: the parts list first, a part opens as a page, ‹ Parts goes back; the light theme is remembered', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(390, { theme: 'light' });
  try {
    await openFile(page, ZIP);
    const state = () => page.evaluate(() => ({ page: document.querySelector('.sbody').dataset.page, list: getComputedStyle(document.querySelector('.phonelist')).display, spage: getComputedStyle(document.querySelector('.spage')).display, side: getComputedStyle(document.querySelector('.snav')).display, scheme: document.querySelector('.su-root').dataset.scheme }));
    assert.deepEqual(await state(), { page: 'list', list: 'flex', spage: 'none', side: 'none', scheme: 'light' });
    const header = await page.evaluate(() => {
      const shd = document.querySelector('.shd').getBoundingClientRect();
      return { height: Math.round(shd.height), small: [...document.querySelectorAll('.shd button')].map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length };
    });
    assert.deepEqual(header, { height: 69, small: 0 }, 'one header row as tall as the mock Settings header, every button at least 44 x 44');
    await page.click('.slist button[data-part="cast"]');
    assert.deepEqual(await state(), { page: 'section', list: 'none', spage: 'flex', side: 'none', scheme: 'light' });
    await page.click('.sback');
    assert.equal((await state()).page, 'list');
    await page.click('.st-theme');
    assert.equal((await state()).scheme, 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('storySuite.studio.theme')), 'dark');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`at ${width} in ${theme}: the frame fills the window and nothing runs sideways on Overview, Cast or Problems`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const { page, errors } = await studio(width, { theme });
      try {
        await openFile(page, WORLD);
        const frame = await page.evaluate(() => { const box = document.querySelector('.st-app').getBoundingClientRect(); return [Math.round(box.left), Math.round(box.width)]; });
        assert.deepEqual(frame, width > 600 ? [18, width - 36] : [0, width]);
        for (const part of ['overview', 'cast', 'problems']) {
          await page.click(width > 600 ? `.snav .si3[data-part="${part}"]` : `.slist button[data-part="${part}"]`);
          assert.deepEqual(await sideways(page), [], `${part} at ${width} ${theme}`);
          if (width <= 600) await page.click('.sback');
        }
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  }
}
