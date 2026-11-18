// Rendered check of what the Studio's editing context does around the editors (studio/app.js), in a real browser: a new pack lists every
// part and its first edit writes the part's empty value in the same undo step; a refused edit is said once; a note after a change
// outlives the redraw; Escape closes a sheet; Go to reaches a place's field and the box being typed in keeps the focus; the nav does
// not draw Pairing; an old-format pack reads as read-only and not checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { writeStoredZip } from '../../../studio/zip-write.js';

const ZIP3 = path.join(ROOT, 'tests/fixtures/packs/ersveil-3/ersveil.zip');
const WORLD4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/world4-mini.json'));
const GAME4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/game4-mini.json'));
const ZIP4 = { name: 'world4.zip', mimeType: 'application/zip', buffer: Buffer.from(writeStoredZip([{ name: 'pack.json', bytes: WORLD4 }, { name: 'game.json', bytes: GAME4 }])) };

// A Dry run page of the test's own (a `part` page): buttons that make a refused edit (said by the page itself, or not), an edit with
// a note after it, and a picker sheet. The Pairing page counts its draws.
const OWN_DRY = `import { h } from '../../ui/kit/dom.js';
import { openPicker } from '../form/pick.js';
export function renderPage(ctx) {
    const local = h('p', { class: 'st-problem', hidden: true });
    return [h('div', { class: 'sgrp' },
        h('button', { type: 'button', class: 'own-local', onClick: () => { const r = ctx.commit([{ op: 'set', path: ['content', 'nope', 'y'], value: 1 }]); local.textContent = r.refusal; local.hidden = false; } }, 'local'),
        h('button', { type: 'button', class: 'own-bad', onClick: () => ctx.commit([{ op: 'set', path: ['content', 'gone', 'x'], value: 1 }]) }, 'bad'),
        h('button', { type: 'button', class: 'own-say', onClick: () => { if (ctx.commit([{ op: 'set', path: ['name'], value: 'Renamed' }]).ok) ctx.say('Said after the change.'); } }, 'say'),
        h('button', { type: 'button', class: 'own-pick', onClick: () => openPicker({}, { title: 'Pick one', items: [{ id: 'a', label: 'A' }] }, () => {}) }, 'pick'),
        local)];
}`;
const OWN_PAIRING = `import { h } from '../../ui/kit/dom.js';
export function renderPage(ctx) { globalThis.pairDraws = (globalThis.pairDraws ?? 0) + 1; return [h('p', { class: 'st-own-pair' }, 'pairing')]; }`;

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

async function studio(width, swap = {}) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${ctx.port}/`)) return route.abort();
    const own = swap[new URL(url).pathname];
    return own ? route.fulfill({ contentType: 'text/javascript', body: own }) : route.continue();
  });
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  return { page, errors };
}

async function openFile(page, file) {
  const before = await page.textContent('.shd .ttl small');
  await page.setInputFiles('.st-file', file);
  await page.waitForFunction(text => document.querySelector('.shd .ttl small').textContent !== text, before);
  await page.waitForSelector('.st-foot:not([hidden])');
}

const world = page => page.evaluate(() => {
  const pack = globalThis.storySuiteStudio.state.packs.world;
  return { lore: pack.doc.content.lore, edited: pack.edited, canUndo: pack.canUndo };
});

test('New world on a phone: Overview says it is new, every World part is listed as nothing yet, and the first lore entry is one undo step', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(390);
  try {
    await page.click('.st-new[data-kind="world"]');
    await page.fill('.sh-panel input[aria-label="Name"]', 'Saltmarsh');
    await page.click('.st-create');
    await page.waitForSelector('.st-check');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('.sbody').dataset.page, document.querySelector('.spage h2').textContent, document.querySelector('.st-check small').textContent]),
      ['section', 'Overview', 'New in the Studio, not exported yet.']);
    const rows = await page.$$eval('.spage .sgrp .srow .lb', nodes => nodes.map(node => node.textContent).filter(text => /Nothing yet/.test(text)));
    assert.equal(rows.length, 8, 'Lore, Cast, Places & routes, Conditions, Events, Templates, Powers & scores, Items & foes');
    await page.click('.sback');
    assert.deepEqual(await page.$$eval('.slist button[data-part]', buttons => buttons.map(button => button.dataset.part)),
      ['start', 'overview', 'lore', 'cast', 'map', 'conditions', 'events', 'templates', 'powers', 'items', 'timeline', 'pairing', 'problems']);
    // Looking at every part writes nothing.
    for (const part of ['lore', 'cast', 'map', 'conditions', 'events', 'templates', 'powers', 'items']) {
      await page.click(`.slist button[data-part="${part}"]`);
      const text = await page.evaluate(() => document.querySelector('.spage').textContent);
      assert.doesNotMatch(text, /null|undefined|NaN|\[object Object\]/, `${part} prints no stray value`);
      await page.click('.sback');
    }
    assert.deepEqual(await world(page), { lore: undefined, edited: false, canUndo: false });
    await page.click('.slist button[data-part="lore"]');
    await page.click('.spage .st-new');
    const after = await world(page);
    assert.deepEqual([after.lore.length, after.lore[0].title, after.edited], [1, 'New entry', true]);
    await page.evaluate(() => globalThis.storySuiteStudio.state.packs.world.undo());
    assert.deepEqual(await world(page), { lore: undefined, edited: false, canUndo: false });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('New game: Calendar, Rules and Trackers draw their forms from nothing; the first month writes the calendar in the same step', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280);
  try {
    await page.click('.st-new[data-kind="game"]');
    await page.fill('.sh-panel input[aria-label="Name"]', 'Salt rules');
    await page.click('.st-create');
    await page.waitForSelector('.st-check');
    const game = () => page.evaluate(() => { const pack = globalThis.storySuiteStudio.state.packs.game; return { content: pack.doc.content, edited: pack.edited }; });
    for (const part of ['rules', 'trackers', 'names', 'game-start']) {
      await page.click(`.snav .si3[data-part="${part}"]`);
      assert.ok(await page.locator('.spage .st-sec input, .spage .st-sec button').count() > 0, `${part} draws its form`);
    }
    assert.deepEqual(await game(), { content: {}, edited: false });
    // search reads the parts' sections, the weather's empty one too
    await page.keyboard.press('/');
    await page.keyboard.type('weather');
    assert.equal(await page.textContent('.spage h2'), 'Search');
    assert.match(await page.textContent('.spage'), /Weather/);
    assert.doesNotMatch(await page.textContent('.spage'), /null|undefined|NaN|\[object Object\]/);
    await page.keyboard.press('Escape');
    await page.click('.snav .si3[data-part="calendar"]');
    await page.click('.spage button:has-text("+ Add a month")');
    const after = await game();
    assert.deepEqual([Object.keys(after.content), after.content.calendar.months.length, after.edited], [['calendar'], 1, true]);
    await page.evaluate(() => globalThis.storySuiteStudio.state.packs.game.undo());
    assert.deepEqual(await game(), { content: {}, edited: false });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('a refused edit is said in the note line unless its page shows it; a note after a change outlives the redraw; Esc closes a sheet', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280, { '/studio/views/timeline.js': OWN_DRY });
  try {
    await openFile(page, ZIP4);
    await page.click('.snav .si3[data-part="timeline"]');
    const note = () => page.evaluate(() => { const line = document.querySelector('.st-note'); return line.hidden ? '' : line.textContent; });
    await page.click('.own-local');
    assert.equal(await note(), '', 'the page said it by its field');
    await page.click('.own-bad');
    assert.match(await note(), /There is nothing at content\.gone/);
    await page.click('.own-say');
    assert.equal(await note(), 'Said after the change.');
    assert.equal(await page.evaluate(() => globalThis.storySuiteStudio.state.packs.world.doc.name), 'Renamed');
    await page.click('.own-pick');
    assert.equal(await page.locator('.sh-ov').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sh-ov').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'own-pick', 'the focus goes back to the opener');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Go to a place\'s field marks the field, not the JSON row; a chip box keeps the focus after each Enter; the nav does not draw Pairing', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280, { '/studio/views/pairing.js': OWN_PAIRING });
  try {
    await openFile(page, ZIP4);
    await page.evaluate(() => globalThis.storySuiteStudio.show('map', 'places.0', { path: ['region'] }));
    const at = await page.evaluate(() => ({ key: document.activeElement?.closest('[data-key]')?.dataset.key, json: Boolean(document.querySelector('.spage .st-json, .spage textarea.sent')) }));
    assert.deepEqual(at, { key: 'region', json: false });
    const box = page.locator('.spage [data-key="aliases"] input.kadd');
    for (const name of ['Old Fen', 'The Lock']) {
      await box.click();
      await box.fill(name);
      await box.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-key]')?.dataset.key), 'aliases', `the chip box keeps the focus after "${name}"`);
    }
    assert.deepEqual(await page.evaluate(() => globalThis.storySuiteStudio.state.packs.world.doc.content.places[0].aliases), ['Old Fen', 'The Lock']);
    assert.equal(await page.evaluate(() => globalThis.pairDraws ?? 0), 0, 'two edits and their checks drew Pairing no time');
    // a gate whose builder shows hides its text box: Go to lands on "Edit as text" in that row instead
    await page.evaluate(() => globalThis.storySuiteStudio.state.packs.world.commit([{ op: 'set', path: ['content', 'lore', 0, 'gate'], value: 'fired:nowhere' }]));
    await page.evaluate(() => globalThis.storySuiteStudio.show('lore', 'lore.0', { path: ['gate'] }));
    assert.deepEqual(await page.evaluate(() => [document.activeElement?.textContent, document.activeElement?.closest('[data-key]')?.dataset.key]), ['Edit as text', 'gate']);
    await page.click('.snav .si3[data-part="pairing"]');
    assert.equal(await page.textContent('.st-own-pair'), 'pairing');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('an old-format pack: the subtitle says read-only, the foot bar says not checked, and Export is off with no note', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(1280);
  try {
    await openFile(page, ZIP3);
    const seen = await page.evaluate(() => ({
      sub: document.querySelector('.shd .ttl small').textContent,
      foot: document.querySelector('.st-foot .v').textContent,
      off: [...document.querySelectorAll('.st-zip, .st-json-out')].every(button => button.disabled),
      note: !document.querySelector('#st-block')?.closest('[hidden]') && Boolean(document.querySelector('#st-block')?.textContent),
      pack: [...document.querySelectorAll('.spage .sgrp')].find(group => group.querySelector('.gt')?.textContent === 'Pack')?.querySelectorAll('.srow b').length,
    }));
    assert.match(seen.sub, / · Read-only$/);
    assert.equal(await page.textContent('.st-check b'), 'Opened read-only: an old-format pack.');
    await page.keyboard.press('Control+s');
    assert.equal(await page.evaluate(() => document.querySelector('.st-note').hidden || !/Exported/.test(document.querySelector('.st-note').textContent)), true, 'Ctrl+S exports nothing');
    assert.deepEqual([seen.foot, seen.off, seen.note], ['Old format: not checked', true, false]);
    assert.ok(seen.pack >= 3);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
