// Rendered check of Export lorebook in the Pack Studio: on for a world with lore (the file is the converter's book, no hidden text), off with
// the reason for a game pack and for a world with no lore; at 390 and 1280, dark and light, nothing runs sideways. Shots: LORE_SHOTS=<folder>.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { lorebookFromPack } from '../../../packs/lorebook-make/convert.js';

const ZIP = path.join(ROOT, 'examples/packs/ersveil.zip');
const PACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/packs/ersveil/pack.json'), 'utf8'));
const GAME4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/game4-mini.json'));
const NOLORE = Buffer.from(JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/world4-mini.json'), 'utf8')), content: { lore: [] } }));
const SHOTS = process.env.LORE_SHOTS;

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

async function studio(width, theme = 'dark') {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  return { page, errors };
}
async function openFile(page, file) {
  const before = await page.textContent('.shd .ttl small');
  await page.setInputFiles('.st-file', file);
  await page.waitForFunction(text => document.querySelector('.shd .ttl small').textContent !== text, before);
}
const pick = (name, buffer) => ({ name, mimeType: 'application/json', buffer });
const sideways = page => page.evaluate(() => {
  const app = document.querySelector('.st-app').getBoundingClientRect();
  return [...document.querySelectorAll('.st-app *')].filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && el.closest('.st-json') === null && (box.right > app.right + 1 || box.left < app.left - 1); }).map(el => el.className || el.tagName).slice(0, 5);
});

test('Export lorebook downloads the converter\'s book with the note, and is off with a reason for a game and a world with no lore', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { counts, book } = lorebookFromPack(PACK, { packName: PACK.name });
  assert.ok(counts.hidden > 0);
  const { page, errors } = await studio(1280);
  try {
    await openFile(page, ZIP);
    assert.equal(await page.isDisabled('.st-lore-out'), false);
    assert.equal(await page.textContent('.st-lore-note'), `${counts.entries} entries; ${counts.hidden} hidden entries kept out.`);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('.st-lore-out')]);
    assert.equal(download.suggestedFilename(), 'ersveil-lorebook.json');
    const text = fs.readFileSync(await download.path(), 'utf8');
    assert.deepEqual(JSON.parse(text), book);
    for (const record of PACK.content.lore.filter(record => record.hidden)) assert.equal(text.includes(record.text), false, `hidden "${record.title}" stays out`);
    assert.equal(await page.textContent('.st-note:not([hidden])'), 'Exported ersveil-lorebook.json.');
    await openFile(page, pick('world.json', NOLORE));
    assert.equal(await page.isDisabled('.st-lore-out'), true);
    assert.match(await page.textContent('.st-lore-note'), /no lore/);
    await openFile(page, pick('game.json', GAME4));
    assert.equal(await page.isDisabled('.st-lore-out'), true);
    assert.match(await page.textContent('.st-lore-note'), /game pack has no lore/);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

for (const width of [390, 1280]) for (const theme of ['dark', 'light']) {
  test(`Export lorebook at ${width} px, ${theme}: shows the note and nothing runs sideways`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(width, theme);
    try {
      await openFile(page, ZIP);
      assert.deepEqual(await sideways(page), []);
      assert.equal(await page.isVisible('.st-lore-out'), true);
      assert.equal(await page.isVisible('.st-lore-note'), true);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `plstudio-${width}-${theme}.png`) });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
