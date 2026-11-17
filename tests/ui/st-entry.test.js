import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeDom } from './helpers/dom.js';
import { startView, firstPaint } from '../../ui/entry/start.js';
import { buildSelectors } from '../../ui/select/build.js';
import { readOldView, writeOldView, OLD_VIEW_KEY } from '../../ui/entry/flag.js';

const TABS = ['card', 'now', 'chat', 'party', 'bag', 'people', 'dossier', 'world', 'journal', 'story', 'scene', 'fight', 'settings'];

function page() {
  const doc = installFakeDom();
  doc.head = doc.createElement('head');
  doc.getElementById = id => doc.querySelector(`#${id}`);
  for (const id of ['extensions_settings2', 'extensionsMenu', 'chat', 'send_textarea']) {
    const el = doc.createElement('div');
    el.id = id;
    doc.body.appendChild(el);
  }
  const form = doc.createElement('div');
  form.id = 'send_form';
  doc.body.appendChild(form);
  return doc;
}

function fakeBlock() {
  const listeners = {};
  const sdk = {
    query: (name, args) => (name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : name === 'scene.place' ? { name: 'Inn' } : null),
    command: async () => ({ ok: true }),
    preview: async () => ({ ok: true }),
    commit: async () => ({ ok: true }),
    reread: async () => ({ ok: true }),
    on: (event, fn) => { (listeners[event] ??= []).push(fn); return () => {}; },
    settings: Object.assign(() => ({}), { defaults: {}, schema: {} }),
    features: () => [],
  };
  return { ready: Promise.resolve(sdk), sdk };
}

// This device's storage, as localStorage answers.
function fakeStorage(old = false) {
  const map = new Map(old ? [[OLD_VIEW_KEY, '1']] : []);
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: k => { map.delete(k); } };
}

// The old view's Extensions drawer as mountUi draws it: the status line, its two buttons, then the strip switch.
function oldDrawer(doc) {
  const root = doc.createElement('div');
  root.id = 'story_suite_v2_drawer';
  const content = doc.createElement('div');
  content.className = 'inline-drawer-content';
  const status = doc.createElement('p');
  const buttons = doc.createElement('div');
  buttons.className = 'story-suite-drawer-buttons old';
  content.append(status, buttons);
  root.appendChild(content);
  doc.getElementById('extensions_settings2').appendChild(root);
  return content;
}

function fakeCtx(next) {
  const ctx = { extensionSettings: next === undefined ? {} : { storySuite: { ui: { next } } }, name1: 'Reader', chatMetadata: {}, saved: 0 };
  ctx.saveSettingsDebounced = () => { ctx.saved += 1; };
  return ctx;
}

test('buildSelectors has one selector per tab and never throws on empty answers', () => {
  const selectors = buildSelectors(() => null, null);
  assert.deepEqual(Object.keys(selectors).sort(), [...TABS, 'inspector', 'problems', 'sent'].sort());   // the Tools page's own live reads follow the tabs
  const read = () => null;
  for (const tab of [...TABS, 'inspector', 'problems', 'sent']) assert.doesNotThrow(() => selectors[tab](read), tab);
  assert.equal(selectors.fight(read), null);
});

test('buildSelectors builds the card and chat view-models from sdk queries', () => {
  const selectors = buildSelectors(() => ({ name1: 'Reader' }), null);
  const read = name => (name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : name === 'scene.place' ? { name: 'Inn' } : null);
  const card = selectors.card(read);
  assert.equal(card.rpg, true);
  assert.equal(card.scene.place, 'Inn');
  assert.equal(selectors.chat(read).inlineRow.place, 'Inn');
  assert.equal(selectors.chat(() => null).inlineRow.fightOpen, false);
});

const start = (doc, ctx, storage, more = {}) => startView({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/', storage, ...more });

test('by default the new view mounts: body class, styles, the "Story Suite" menu entry, no preview wording and no switch', async () => {
  const doc = page();
  const api = await start(doc, fakeCtx(), fakeStorage());
  assert.equal(api.isOn(), true);
  assert.ok(doc.body.classList.contains('ss-ui-next'));
  assert.ok(doc.querySelector('.su-root'));
  assert.equal(doc.querySelector('#story-suite-ui-menu').textContent, 'Story Suite');
  assert.equal(doc.head.querySelectorAll('link').length, 16);
  assert.equal(doc.querySelector('#story-suite-old-view'), null, 'no switch on the default path');
  assert.equal(/preview/i.test(doc.body.textContent), false);
});

test('firstPaint hides the old furniture before boot unless this device chose the old view; index.js calls it before boot and startView after', () => {
  const doc = page();
  assert.equal(firstPaint(doc, fakeStorage()), true);
  assert.ok(doc.body.classList.contains('ss-ui-next'));
  const old = page();
  assert.equal(firstPaint(old, fakeStorage(true)), false);
  assert.equal(old.body.classList.contains('ss-ui-next'), false);
  const entry = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8');
  assert.ok(entry.indexOf('firstPaint();') > 0 && entry.indexOf('firstPaint();') < entry.indexOf('boot({ late })'), 'firstPaint runs before boot');
  assert.match(entry, /if \(started\) await startView\(\);/);
});

test('a stored ui.next false (the old preview switch) does not bring the old view back', async () => {
  const doc = page();
  const api = await start(doc, fakeCtx(false), fakeStorage());
  assert.equal(api.isOn(), true);
  assert.ok(doc.querySelector('.su-root'));
});

test('the new view does not wait for the extension settings: it mounts with no settings host', async () => {
  const doc = page();
  doc.getElementById('extensions_settings2').remove();
  const api = await start(doc, fakeCtx(), fakeStorage());
  assert.equal(api.isOn(), true);
  assert.ok(doc.querySelector('.su-root'));
});

test('this device chose the old view: nothing of the new view, the body class goes, and the ticked way back is drawn', async () => {
  const doc = page();
  doc.body.classList.add('ss-ui-next');   // index.js hides the old furniture from the first paint only when the old view is not chosen; a stale class goes
  const storage = fakeStorage(true);
  const api = await start(doc, fakeCtx(), storage);
  assert.equal(api.isOn(), false);
  assert.equal(doc.querySelector('.su-root'), null);
  assert.equal(doc.querySelector('#story-suite-ui-menu'), null);
  assert.equal(doc.body.classList.contains('ss-ui-next'), false);
  assert.equal(doc.head.querySelectorAll('link').length, 0);
  const row = doc.querySelector('#story-suite-old-view');
  assert.ok(row);
  assert.equal(row.querySelector('input').checked, true);
  assert.match(row.textContent, /use the old view/);
  row.querySelector('input').checked = false;
  row.querySelector('input').dispatchEvent(new Event('change'));
  assert.equal(api.isOn(), true, 'unticking brings the new view back');
  assert.equal(storage.map.has(OLD_VIEW_KEY), false);
  assert.equal(doc.querySelector('#story-suite-old-view'), null);
  assert.ok(doc.querySelector('.su-root'));
});

test('useOldView(true) takes the new view away and keeps the choice; useOldView(false) mounts it again, once', async () => {
  const doc = page();
  const storage = fakeStorage();
  const api = await start(doc, fakeCtx(), storage);
  await api.useOldView(true);
  assert.equal(storage.map.get(OLD_VIEW_KEY), '1');
  assert.equal(api.isOn(), false);
  assert.equal(doc.querySelector('.su-root'), null);
  assert.equal(doc.body.classList.contains('ss-ui-next'), false);
  assert.equal(doc.head.querySelectorAll('link').length, 0);
  assert.ok(doc.querySelector('#story-suite-old-view'));
  api.useOldView(false);
  api.useOldView(false);
  assert.equal(doc.querySelectorAll('.su-root').length, 1);
  assert.equal(doc.querySelector('#story-suite-old-view'), null);
  assert.equal(readOldView(storage), false);
  // A reload after choosing the old view starts in the old view.
  await api.useOldView(true);
  const again = page();
  assert.equal((await start(again, fakeCtx(), storage)).isOn(), false);
});

test('the choice guards a device with no storage: read says new view, write says false, the view still mounts and goes', async () => {
  assert.equal(readOldView(null), false);
  assert.equal(readOldView({ getItem: () => { throw new Error('denied'); } }), false);
  assert.equal(writeOldView(true, null), false);
  const doc = page();
  const api = await start(doc, { name1: 'Reader', chatMetadata: {} }, null);
  assert.equal(api.isOn(), true);
  await api.useOldView(true);
  assert.equal(api.isOn(), false);
  const row = doc.querySelector('#story-suite-old-view');
  assert.ok(row, 'the way back is drawn even with nothing stored');
  row.querySelector('input').checked = false;
  row.querySelector('input').dispatchEvent(new Event('change'));
  assert.equal(api.isOn(), true);
});

test('the Story Suite drawer gets the new view\'s Settings and Open buttons after its status line; they go with the view', async () => {
  const doc = page();
  const content = oldDrawer(doc);
  const storage = fakeStorage();
  const api = await start(doc, fakeCtx(), storage);
  const row = doc.querySelector('#story-suite-next-drawer');
  assert.ok(row);
  assert.equal(content.children[1], row);
  assert.deepEqual([...row.querySelectorAll('button')].map(b => b.textContent), ['Settings', 'Open Story Suite']);
  row.querySelectorAll('button')[0].click();
  assert.equal(doc.querySelector('.su-layer').getAttribute('data-state'), 'open');
  assert.ok(doc.querySelector('.su-root .shd'), 'the new view\'s settings overlay opened');
  await api.useOldView(true);
  assert.equal(doc.querySelector('#story-suite-next-drawer'), null);
  assert.ok(doc.querySelector('#story-suite-old-view'));
  assert.equal(storage.map.get(OLD_VIEW_KEY), '1');
});

test('startView does nothing without Story Block or the context, and takes the first-paint class away', async () => {
  const doc = page();
  doc.body.classList.add('ss-ui-next');
  assert.equal(await startView({ doc, getContext: () => fakeCtx(), StoryBlock: null, storage: fakeStorage() }), null);
  assert.equal(doc.body.classList.contains('ss-ui-next'), false);
  assert.equal(await startView({ doc, getContext: () => null, StoryBlock: fakeBlock(), storage: fakeStorage() }), null);
});

test('startView takes the Story Block global the entry started', async () => {
  const doc = page();
  const ctx = fakeCtx();
  const savedTavern = globalThis.SillyTavern;
  const savedBlock = globalThis.StoryBlock;
  globalThis.SillyTavern = { getContext: () => ctx };
  try {
    delete globalThis.StoryBlock;
    assert.equal(await startView({ doc, base: 'x/', storage: fakeStorage() }), null, 'no host: nothing drawn, no waiting');
    assert.equal(doc.querySelector('.su-root'), null);
    globalThis.StoryBlock = fakeBlock();
    assert.ok((await startView({ doc, base: 'x/', storage: fakeStorage() })).isOn());
  } finally {
    if (savedTavern === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = savedTavern;
    if (savedBlock === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = savedBlock;
  }
});

test('the way back waits for the settings host that appears after the extension entry runs', async () => {
  const doc = page();
  const host = doc.getElementById('extensions_settings2');
  host.remove();
  const pending = start(doc, fakeCtx(), fakeStorage(true));
  await new Promise(resolve => setTimeout(resolve, 30));
  doc.body.appendChild(host);
  assert.equal((await pending).isOn(), false);
  assert.ok(doc.querySelector('#story-suite-old-view'));
});

test('the one manifest names the root entry and suite.css; suite.css lists the hide sheet, which names every old furniture class, scoped to the body class', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'suite.css');
  assert.equal(fs.existsSync(new URL('../../ui/manifest.json', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../../ui/st-entry.js', import.meta.url)), false);
  assert.match(fs.readFileSync(new URL('../../suite.css', import.meta.url), 'utf8'), /@import url\('\.\/ui\/css\/next-hide\.css'\)/);
  const css = fs.readFileSync(new URL('../../ui/css/next-hide.css', import.meta.url), 'utf8');
  for (const sel of ['.story-suite-bar', '.ss-cards', '.ss-hud', '.story-suite-extras', '.story-suite-reply-note', '#story_suite_v2_menu', '.story-suite-drawer-buttons:not(#story-suite-next-drawer)', '.story-suite-hud-toggle']) assert.ok(css.includes(`body.ss-ui-next ${sel}`), sel);
});
