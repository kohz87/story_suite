// The live entry's device store for folded Settings cards: a fold reaches localStorage through the port's prefs, and a reload (new prefs,
// new port, the same storage) opens the card folded; the view's other folds are not kept by it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';

const storage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const live = store => createPrefs({ storage: store });

test('a folded Settings card is kept on the device and comes back after a reload', () => {
  const store = storage();
  const doc = installFakeDom();
  const open = prefs => { const ov = createSettingsOverlay({ doc, settings: buildSettings(), renderSection: renderSettingsSection, onChange: () => {}, onAction: () => {}, prefs }); ov.open('people'); return ov; };
  const card = (ov, name) => ov.el.querySelectorAll('.sgrp').find(c => c.querySelector('.gt').textContent === name);
  card(open(live(store)), 'Portraits').querySelector('.gt').click();
  assert.deepEqual(JSON.parse(store.m.get('storySuite.ui.fold')), { 'settings.fold.people.portraits': true });
  const again = open(live(store));
  assert.equal(card(again, 'Portraits').querySelector('.gt').getAttribute('aria-expanded'), 'false');
  card(again, 'Portraits').querySelector('.gt').click();
  assert.deepEqual(JSON.parse(store.m.get('storySuite.ui.fold')), { 'settings.fold.people.portraits': false });
});

test('one store: a fold and the other device prefs share storySuite.ui.fold, bad stored data keeps nothing', () => {
  const store = storage();
  const prefs = createPrefs({ storage: store });
  prefs.setFold('settings.fold.look.skin', true);
  prefs.setFold('journal.closed', true);
  assert.deepEqual(JSON.parse(store.m.get('storySuite.ui.fold')), { 'settings.fold.look.skin': true, 'journal.closed': true });
  assert.deepEqual([...store.m.keys()], ['storySuite.ui.fold'], 'no second key');
  store.m.set('storySuite.ui.fold', 'not json');
  assert.equal(createPrefs({ storage: store }).getFold('settings.fold.look.skin'), false);
});

test('the live entry keeps a folded card through a remount of the view (the device store is wired in turn-on)', async t => {
  const { installFakeDom: pageDom } = await import('../helpers/dom.js');
  const { startView } = await import('../../../ui/entry/start.js');
  const store = storage();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  t.after(() => { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; });
  const doc = pageDom();
  doc.head = doc.createElement('head');
  doc.getElementById = id => doc.querySelector(`#${id}`);
  for (const id of ['extensions_settings2', 'extensionsMenu', 'chat', 'send_textarea', 'send_form']) { const el = doc.createElement('div'); el.id = id; doc.body.appendChild(el); }
  const drawer = doc.createElement('div'); drawer.id = 'story_suite_v2_drawer';
  const content = doc.createElement('div'); content.className = 'inline-drawer-content';
  content.append(doc.createElement('p'), Object.assign(doc.createElement('div'), { className: 'story-suite-drawer-buttons old' }));
  drawer.appendChild(content); doc.getElementById('extensions_settings2').appendChild(drawer);
  const sdk = { query: () => null, command: async () => ({ ok: true }), on: () => () => {}, settings: Object.assign(() => ({}), { defaults: {}, schema: {} }), features: () => [] };
  const ctx = { extensionSettings: {}, name1: 'Reader', chatMetadata: {}, saveSettingsDebounced() {} };
  const start = () => startView({ doc, getContext: () => ctx, StoryBlock: { ready: Promise.resolve(sdk), sdk }, base: 'x/', storage: store });
  const api = await start();
  const skin = () => {
    doc.querySelector('#story-suite-next-drawer').querySelectorAll('button')[0].click();
    doc.querySelector('.su-root .si3[data-sec="people"]').click();
    return doc.querySelectorAll('.su-root .sov .sgrp').find(c => c.querySelector('.gt').textContent === 'Feelings');
  };
  skin().querySelector('.gt').click();
  assert.deepEqual(JSON.parse(store.m.get('storySuite.ui.fold')), { 'settings.fold.people.feelings': true });
  // A remount: the view is taken away and started again (a fresh turn-on over the same device storage).
  api.stop();
  const again = await start();
  t.after(() => again.stop());
  assert.equal(skin().querySelector('.gt').getAttribute('aria-expanded'), 'false', 'a new mount reads it back');
});
