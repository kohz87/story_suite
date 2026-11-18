// Rendered check of the Pack Studio page (studio/index.html) in a real browser: the whole packs/validate import graph loads, a pack
// zip opens and is checked, every part has a page, Problems and Go to reach the record, search, the keys, Export gives back the same
// zip, and the phone list → page → back; at 390, 1143, 1280 and 1920, dark and light, nothing runs sideways.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { writeStoredZip } from '../../../studio/zip-write.js';

const ZIP = path.join(ROOT, 'examples/packs/ersveil.zip');
const WORLD = path.join(ROOT, 'tests/packs/studio/fixtures/world-mini.json');
const WORLD4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/world4-mini.json'));
const GAME4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/game4-mini.json'));
const WREN = fs.readFileSync(path.join(ROOT, 'examples/packs/ersveil/portraits', JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/packs/ersveil/pack.json'))).content.cast[0].portrait));
const ZIP4 = Buffer.from(writeStoredZip([{ name: 'pack.json', bytes: WORLD4 }, { name: 'game.json', bytes: GAME4 }, { name: 'portraits/wren.webp', bytes: WREN }]));

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

// `swap`: { '/studio/views/map.js': source } serves a slot file of the test's own, as a later job's page would be.
async function studio(width, { theme = 'dark', swap = {} } = {}) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${ctx.port}/`)) return route.abort();
    const own = swap[new URL(url).pathname];
    return own ? route.fulfill({ contentType: 'text/javascript', body: own }) : route.continue();
  });
  await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  return { page, errors };
}

// `file`: a path, a { name, mimeType, buffer } or a list of them. Waits until the header names what was opened.
async function openFile(page, file) {
  const before = await page.textContent('.shd .ttl small');
  await page.setInputFiles('.st-file', file);
  await page.waitForFunction(text => document.querySelector('.shd .ttl small').textContent !== text, before);
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
    assert.deepEqual(head, { sub: 'Format 3 · Ersveil (open world) · 3.0.0', foot: 'No problems', nav: ['overview', 'other', 'cast', 'map', 'events', 'items', 'problems'], current: 'overview', title: 'Overview', check: 'true' });
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

test('a world pack: the engine\'s checker refuses what it does not take; Problems lists it by part and Go to reaches the record', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1143);
  try {
    await openFile(page, WORLD);
    assert.equal(await page.textContent('.st-foot .v'), '3 problems · 2 warnings');
    await page.click('.st-foot');
    const groups = await page.evaluate(() => [...document.querySelectorAll('.st-probs')].map(g => g.dataset.part));
    assert.deepEqual([...groups].sort(), ['conditions', 'events']);
    await page.locator('.st-probs[data-part="events"] .lnk').first().click();
    const hit = await page.evaluate(() => ({ part: document.querySelector('.snav .si3[aria-current="true"]').dataset.part, focused: document.activeElement?.dataset?.rec, marked: document.querySelector('.st-hit')?.dataset.rec }));
    assert.deepEqual(hit, { part: 'events', focused: 'worldEvents.0', marked: 'worldEvents.0' });
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
    assert.equal(await page.textContent('.spage h2'), 'Conditions');
    await page.keyboard.press('F8');
    assert.equal(await page.textContent('.spage h2'), 'Events');
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

const pick = (name, buffer, mimeType = 'application/json') => ({ name, mimeType, buffer });
const nav = page => page.evaluate(() => ({
  sub: document.querySelector('.shd .ttl small').textContent,
  groups: [...document.querySelectorAll('.snav .grpl')].map(g => g.textContent),
  parts: [...document.querySelectorAll('.snav .si3')].map(b => b.dataset.part),
  zip: document.querySelector('.st-zip').disabled,
}));

test('format 4: a world zip with game.json opens both packs; a Game part makes the game active; Export gives back each pack', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280);
  try {
    await openFile(page, pick('world4.zip', ZIP4, 'application/zip'));
    assert.deepEqual(await nav(page), { sub: 'World · Studio world 4 (test) · 0.1.0', groups: ['Pack', 'World', 'Game', 'Check'], parts: ['overview', 'lore', 'cast', 'map', 'conditions', 'powers', 'calendar', 'money', 'names', 'game-start', 'problems'], zip: false });
    assert.equal(await page.locator('.st-convert').count(), 0);
    assert.equal(await page.locator('.st-seg').count(), 0);
    assert.equal(await page.textContent('.st-other .lb b'), 'Game pack · Studio game 4 (test) · 0.1.0');
    await page.click('.snav .si3[data-part="money"]');
    const game = await nav(page);
    assert.deepEqual([game.sub, game.zip], ['Game · Studio game 4 (test) · 0.1.0', true]);
    assert.deepEqual(await page.$$eval('.spage .st-sec', secs => secs.map(sec => sec.dataset.key)), ['currency']);
    await page.click('.snav .si3[data-part="overview"]');
    assert.equal(await page.textContent('.st-other .lb b'), 'World pack · Studio world 4 (test) · 0.1.0');
    const [json] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
    assert.equal(json.suggestedFilename(), 'pack.json');
    assert.deepEqual(fs.readFileSync(await json.path()), GAME4);
    await page.click('.st-other .lnk');
    assert.equal((await nav(page)).sub, 'World · Studio world 4 (test) · 0.1.0');
    await page.click('.snav .si3[data-part="cast"]');
    // The world's portrait still loads after the game was active (a revoked URL never would).
    await page.waitForFunction(() => { const img = document.querySelector('.spage img.st-thumb'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 5000 });
    const [zip] = await Promise.all([page.waitForEvent('download'), page.click('.st-zip')]);
    assert.equal(zip.suggestedFilename(), 'studio-world4-mini-0.1.0.zip');
    assert.deepEqual(fs.readFileSync(await zip.path()), ZIP4);
    // Opening a game alone keeps the world; a world alone keeps the game.
    await openFile(page, pick('game.json', GAME4));
    assert.equal((await nav(page)).sub, 'Game · Studio game 4 (test) · 0.1.0');
    assert.ok((await nav(page)).parts.includes('cast'));
    await page.click('.snav .si3[data-part="cast"]');
    await page.waitForFunction(() => { const img = document.querySelector('.spage img.st-thumb'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 5000 });
    await page.click('.snav .si3[data-part="money"]'); // the game active again, so the header changes when the world opens
    await openFile(page, [pick('pack.json', WORLD4), pick('wren.webp', WREN, 'image/webp')]);
    assert.ok((await nav(page)).parts.includes('calendar'));
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('format 3 opens read-only with the Convert card at the top of Overview; a game part never shows for it', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1143);
  try {
    await openFile(page, ZIP);
    assert.match(await page.textContent('.spage > .st-convert .lb b'), /format 3, so it opens read-only/);
    assert.equal(await page.evaluate(() => document.querySelector('.spage > .st-convert').nextElementSibling.classList.contains('st-check')), true);
    assert.ok(!(await nav(page)).groups.includes('Game'));
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('the slots: a page that draws something is mounted where route.js says (segment, Check part); an empty stub is not', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const drawn = label => `import { h } from '../../ui/kit/dom.js'; export function renderPage(ctx) { return [h('p', { class: 'st-own' }, '${label} ' + ctx.kind + ' ' + Boolean(ctx.other))]; }`;
  const { page, errors } = await studio(1280, { swap: { '/studio/views/map.js': drawn('map'), '/studio/views/timeline.js': drawn('dry run'), '/studio/views/pairing.js': drawn('pairing') } });
  try {
    await openFile(page, pick('world4.zip', ZIP4, 'application/zip'));
    assert.deepEqual((await nav(page)).parts.slice(-3), ['timeline', 'pairing', 'problems']);
    await page.click('.snav .si3[data-part="map"]');
    assert.deepEqual(await page.$$eval('.st-seg button', bs => bs.map(b => [b.textContent, b.getAttribute('aria-pressed')])), [['List', 'true'], ['Map', 'false']]);
    assert.equal(await page.locator('.spage .st-sec').count(), 4);
    await page.click('.st-seg button[data-view="map"]');
    assert.equal(await page.textContent('.st-own'), 'map world true');
    assert.equal(await page.locator('.spage .st-sec').count(), 0);
    await page.click('.snav .si3[data-part="timeline"]');
    assert.equal(await page.textContent('.st-own'), 'dry run world true');
    // The graph stub draws nothing: no segment on Events. A format 3 world gets no Dry run (its mount needs format 4).
    await openFile(page, ZIP);
    const legacy = (await nav(page)).parts;
    assert.ok(!legacy.includes('timeline') && legacy.includes('pairing'));
    await page.click('.snav .si3[data-part="events"]');
    assert.equal(await page.locator('.st-seg').count(), 0);
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
