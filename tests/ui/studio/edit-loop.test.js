// Rendered check of the Studio's edit loop (studio/index.html in Chromium): open a world zip with its game, edit a record through its
// JSON row (a mistake names its line and keeps Apply off), Undo and Redo (header and keys), the draft saved and offered again after a
// reload (Restore, or Use the file), an error turning Export off with its note, F8 and "Go to the first" opening the JSON row at the field,
// warnings leaving Export on, the edited pack exported as 2-space JSON and an unedited one byte for byte, each pack with its own history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { writeStoredZip } from '../../../studio/zip-write.js';
import { readZip } from '../../../packs/zip.js';

const WORLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/world4-mini.json'), 'utf8'));
const GAME4 = fs.readFileSync(path.join(ROOT, 'tests/packs/studio/fixtures/game4-mini.json'));
const COMPACT = Buffer.from(JSON.stringify(WORLD)); // not 2-space: an export that re-wrote an unedited pack would show
const ZIP = Buffer.from(writeStoredZip([{ name: 'pack.json', bytes: COMPACT }, { name: 'game.json', bytes: GAME4 }]));
const PICK = { name: 'world.zip', mimeType: 'application/zip', buffer: ZIP };

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

// `swap`: { '/studio/views/timeline.js': source } serves a slot file of the test's own, as a later job's page would be.
async function studio(width = 1280, swap = {}) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/*', route => {
    const own = swap[new URL(route.request().url()).pathname];
    return own ? route.fulfill({ contentType: 'text/javascript', body: own }) : route.continue();
  });
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  await openZip(page);
  return { page, errors };
}
async function openZip(page) {
  await page.setInputFiles('.st-file', PICK);
  await page.waitForSelector('.st-foot:not([hidden])');
}
const row = rec => `.st-rec[data-rec="${rec}"]`;
// Shows a record's JSON row, puts `edit(value)` in it and applies it.
async function applyJson(page, rec, edit) {
  if (await page.locator(`${row(rec)} .st-jsonshow`).count()) await page.click(`${row(rec)} .st-jsonshow`);
  const box = page.locator(`${row(rec)} .st-jsonin`);
  await box.fill(JSON.stringify(edit(JSON.parse(await box.inputValue())), null, 2));
  await page.click(`${row(rec)} .st-apply`);
}
const loreTitle = page => page.textContent(`${row('lore.0')} .st-rt b`);
const zipFiles = async download => Object.fromEntries((await readZip(new Uint8Array(fs.readFileSync(await download.path())))).map(entry => [entry.name, entry]));
const exported = async (page, button) => (await Promise.all([page.waitForEvent('download'), page.click(button)]))[0];
// The draft slots the page's IndexedDB holds, polled until `want` (the check and its draft save wait for the debounce).
async function draftsAre(page, want) {
  const keys = () => page.evaluate(() => new Promise(done => {
    const open = indexedDB.open('story-suite-studio', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('drafts');
    open.onsuccess = () => { const req = open.result.transaction('drafts').objectStore('drafts').getAllKeys(); req.onsuccess = () => { open.result.close(); done(req.result); }; };
  }));
  for (let i = 0; i < 50; i++) { if (JSON.stringify(await keys()) === JSON.stringify(want)) return; await page.waitForTimeout(50); }
  assert.deepEqual(await keys(), want);
}
const checked = page => page.waitForFunction(() => !document.querySelector('.st-foot')?.hidden && document.querySelector('.st-foot .v')?.textContent);

test('edit through a JSON row; Undo and Redo; the edited world exports as 2-space JSON beside its unedited game, and undone back as opened', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio();
  try {
    await page.click('.snav .si3[data-part="lore"]');
    assert.equal(await page.locator('.st-jsonin').count(), 0, 'the rows start closed');
    await page.click(`${row('lore.0')} .st-jsonshow`);
    const box = page.locator(`${row('lore.0')} .st-jsonin`);
    const written = await box.inputValue();
    await box.fill(written.replace('"keys"', '"keys" ['));
    assert.match(await page.textContent(`${row('lore.0')} .fprob`), /^✕ Line 3: .* Apply is off until it is fixed\.$/);
    assert.equal(await page.isDisabled(`${row('lore.0')} .st-apply`), true);
    await box.fill(written.replace('"The Lamp Road"', '"The Lamplit Road"'));
    await page.click(`${row('lore.0')} .st-apply`);
    assert.equal(await loreTitle(page), 'The Lamplit Road');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('.st-undo').disabled, document.querySelector('.st-redo').disabled]), [false, true]);
    await page.waitForFunction(() => / · Draft saved \d\d:\d\d$/.test(document.querySelector('.shd .ttl small').textContent));
    assert.match(await page.textContent(`${row('lore.0')} .fprob`), /Checked: no problems in this entry\./);

    const edited = await zipFiles(await exported(page, '.st-zip'));
    const pack = new TextDecoder().decode(await edited['pack.json'].read());
    assert.equal(JSON.parse(pack).content.lore[0].title, 'The Lamplit Road');
    assert.equal(pack, JSON.stringify(JSON.parse(pack), null, 2), 'an edited pack is written as 2-space JSON');
    assert.deepEqual(Buffer.from(await edited['game.json'].read()), GAME4, 'the game was not edited, so it goes out as opened');

    await page.click('.st-undo');
    assert.equal(await loreTitle(page), 'The Lamp Road');
    await page.click('.spage h2');
    await page.keyboard.press('Control+Shift+z');
    assert.equal(await loreTitle(page), 'The Lamplit Road');
    await page.keyboard.press('Control+z');
    assert.equal(await loreTitle(page), 'The Lamp Road');
    assert.equal(await page.isDisabled('.st-undo'), true);
    assert.deepEqual(fs.readFileSync(await (await exported(page, '.st-zip')).path()), ZIP, 'undone to the start: the zip as opened, byte for byte');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('an error turns Export off with its note; F8 and Go to the first open the JSON row at the field; warnings leave Export on', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio();
  try {
    await page.click('.snav .si3[data-part="lore"]');
    await applyJson(page, 'lore.0', value => ({ ...value, bogus: 1 }));
    await page.waitForSelector('.st-block:not([hidden])');
    assert.equal(await page.textContent('.st-block'), 'Export is off until the 1 problem is fixed. Warnings don’t stop it. Go to the first ›');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('.st-zip').disabled, document.querySelector('.st-json-out').disabled]), [true, true]);
    assert.match(await page.textContent('.st-foot'), /1 problem.*Export is off until the problems are fixed/);
    const caret = () => page.evaluate(() => {
      const el = document.activeElement;
      return { rec: el.closest('[data-rec]')?.dataset.rec, box: el.classList.contains('st-jsonin'), at: el.value.slice(el.selectionStart).split('\n')[0] };
    });
    await page.click('.snav .si3[data-part="overview"]');
    await page.keyboard.press('F8');
    assert.deepEqual(await caret(), { rec: 'lore.0', box: true, at: '"bogus": 1' });
    await page.click('.snav .si3[data-part="overview"]');
    await page.click('.st-block .lnk');
    assert.deepEqual(await caret(), { rec: 'lore.0', box: true, at: '"bogus": 1' });

    await page.click('.spage h2');
    await page.click('.st-undo');
    await page.waitForSelector('.st-block', { state: 'hidden' });
    assert.equal(await page.isDisabled('.st-zip'), false);

    await page.click('.snav .si3[data-part="conditions"]');
    await applyJson(page, 'conditions.0', value => ({ ...value, fades: 'until cleared', placeStatus: true }));
    await page.waitForFunction(() => document.querySelector('.st-foot .v').textContent === '1 warning');
    assert.match(await page.textContent('.st-foot'), /Export works; warnings are listed in Problems/);
    assert.equal(await page.locator('.st-block').isHidden(), true);
    const json = await exported(page, '.st-json-out');
    assert.equal(JSON.parse(fs.readFileSync(await json.path(), 'utf8')).content.conditions[0].fades, 'until cleared');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('reload: the saved draft is offered; Restore gives the edit back one undo step from the file; undo to the file or Use the file lets it go', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio();
  try {
    const editAndSave = async () => {
      await page.click('.snav .si3[data-part="lore"]');
      await applyJson(page, 'lore.0', value => ({ ...value, title: 'Drafted road' }));
      await page.waitForFunction(() => document.querySelector('.shd .ttl small').textContent.includes('Draft saved'));
    };
    const reopen = async () => { await page.reload(); await page.waitForSelector('.st-app .st-start'); await openZip(page); };
    await editAndSave();
    await draftsAre(page, ['world:studio-world4-mini']);
    await reopen();
    await page.waitForSelector('.st-restore');
    assert.match(await page.textContent('.st-restore'), /^Restore your draft\?Saved \d+ \w{3}, \d\d:\d\d · changes not exported\. Using the file deletes the draft\.Restore the draftUse the file$/);
    await page.click('.st-take');
    assert.equal(await page.locator('.st-restore').count(), 0);
    await page.click('.snav .si3[data-part="lore"]');
    assert.equal(await loreTitle(page), 'Drafted road');
    await page.click('.st-undo');
    assert.equal(await loreTitle(page), 'The Lamp Road');
    await draftsAre(page, []);
    await reopen();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.st-restore').count(), 0, 'undone to the file: the draft was let go');

    await editAndSave();
    await reopen();
    await page.click('.st-use');
    assert.equal(await page.locator('.st-restore').count(), 0);
    await draftsAre(page, []);
    await reopen();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.st-restore').count(), 0, 'Use the file deleted the draft');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('two packs, two histories: the game edited through its JSON row exports as 2-space JSON, the world stays as opened; phone width', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio(390);
  try {
    await page.click('.slist button[data-part="money"]');
    await applyJson(page, 'currency', value => ({ ...value, short: 'd' }));
    assert.equal(await page.isDisabled('.st-undo'), false);
    await page.click('.sback');
    await page.waitForFunction(() => document.querySelector('.shd .ttl small').textContent.includes('Draft saved'));
    assert.equal(await page.getAttribute('.sbody', 'data-page'), 'list', 'the check and the draft landing redraw the page but leave the phone on the parts list');
    await page.click('.slist button[data-part="money"]');
    const sideways = await page.evaluate(() => {
      const app = document.querySelector('.st-app').getBoundingClientRect();
      return [...document.querySelectorAll('.st-app *')].filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && (box.right > app.right + 1 || box.left < app.left - 1); }).length;
    });
    assert.equal(sideways, 0);
    await page.click('.sback');
    await page.click('.slist button[data-part="lore"]');
    assert.equal(await page.isDisabled('.st-undo'), true, 'the world has its own history, with nothing in it');
    await checked(page);
    const files = await zipFiles(await exported(page, '.st-zip'));
    assert.deepEqual(Buffer.from(await files['pack.json'].read()), COMPACT);
    const game = new TextDecoder().decode(await files['game.json'].read());
    assert.equal(JSON.parse(game).content.currency.short, 'd');
    assert.equal(game, JSON.stringify(JSON.parse(game), null, 2));
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('an error applied and Ctrl+S in the same moment: Export runs the waiting check first and is refused', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const { page, errors } = await studio();
  try {
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.click('.snav .si3[data-part="lore"]');
    await page.click(`${row('lore.0')} .st-jsonshow`);
    const blockHidden = await page.evaluate(() => {
      const box = document.querySelector('[data-rec="lore.0"] .st-jsonin');
      box.value = JSON.stringify({ ...JSON.parse(box.value), bogus: 1 }, null, 2);
      box.dispatchEvent(new Event('input'));
      document.querySelector('[data-rec="lore.0"] .st-apply').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
      return document.querySelector('.st-block').hidden;
    });
    assert.equal(blockHidden, false);
    await page.waitForTimeout(400);
    assert.equal(downloaded, false);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('the editing context a later page gets: refs, setPortrait as one undo step (the cast shows the picture), openDoc as if picked', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const pic = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/packs/ersveil/pack.json'), 'utf8')).content.cast[0].portrait;
  const own = `import { h } from '../../ui/kit/dom.js';
export function renderPage(ctx) {
  if (ctx.kind !== 'world') return [];
  return [h('p', { class: 'st-own' }, 'cast ids ' + ctx.refs.defs.cast.map(d => d.id).join(',')),
    h('button', { class: 'st-pic', onClick: async () => { const bytes = new Uint8Array(await (await fetch('/examples/packs/ersveil/portraits/${pic}')).arrayBuffer()); document.body.dataset.pic = JSON.stringify(ctx.setPortrait('wren.webp', bytes)); } }, 'picture'),
    h('button', { class: 'st-new', onClick: () => { document.body.dataset.made = JSON.stringify(ctx.openDoc({ doc: { ...ctx.doc, id: 'made-world', name: 'Made world' } })); } }, 'new')];
}`;
  const { page, errors } = await studio(1280, { '/studio/views/timeline.js': own });
  try {
    const thumb = () => page.evaluate(() => { const el = document.querySelector('.spage .st-thumb'); return el.tagName === 'IMG' ? (el.complete && el.naturalWidth > 0 ? 'img' : 'loading') : el.textContent; });
    assert.equal(WORLD.content.cast[0].portrait, 'wren.webp');
    await page.click('.snav .si3[data-part="cast"]');
    assert.equal(await thumb(), '?');
    await page.click('.snav .si3[data-part="timeline"]');
    assert.equal(await page.textContent('.st-own'), `cast ids ${WORLD.content.cast.map(person => person.id).join(',')}`);
    await page.click('.st-pic');
    await page.waitForFunction(() => document.body.dataset.pic);
    assert.equal(await page.evaluate(() => document.body.dataset.pic), '{"ok":true}');
    await page.click('.snav .si3[data-part="cast"]');
    await page.waitForFunction(() => document.querySelector('.spage img.st-thumb')?.naturalWidth > 0);
    await page.click('.st-undo');
    assert.equal(await thumb(), '?');
    await page.click('.snav .si3[data-part="timeline"]');
    await page.click('.st-new');
    assert.equal(await page.evaluate(() => document.body.dataset.made), '{"ok":true}');
    assert.equal(await page.textContent('.shd .ttl small'), 'World · Made world · 0.1.0');
    assert.equal(await page.textContent('.st-other .lb b'), 'Game pack · Studio game 4 (test) · 0.1.0');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
