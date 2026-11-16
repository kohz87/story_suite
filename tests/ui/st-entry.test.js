import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeDom } from './helpers/dom.js';
import { startPreview } from '../../ui/entry/start.js';
import { buildSelectors } from '../../ui/select/build.js';
import { readFlag, writeFlag } from '../../ui/entry/flag.js';

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

function fakeCtx(next) {
  const ctx = { extensionSettings: next === undefined ? {} : { storySuite: { ui: { next } } }, name1: 'Reader', chatMetadata: {}, saved: 0 };
  ctx.saveSettingsDebounced = () => { ctx.saved += 1; };
  return ctx;
}

test('buildSelectors has one selector per tab and never throws on empty answers', () => {
  const selectors = buildSelectors(() => null, null);
  assert.deepEqual(Object.keys(selectors).sort(), [...TABS].sort());
  const read = () => null;
  for (const tab of TABS) assert.doesNotThrow(() => selectors[tab](read), tab);
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

test('flag off: only the switch is drawn and the body class stays off', async () => {
  const doc = page();
  const ctx = fakeCtx();
  const api = await startPreview({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/' });
  assert.equal(api.isOn(), false);
  assert.ok(doc.querySelector('#story-suite-ui-next'));
  assert.equal(doc.body.classList.contains('ss-ui-next'), false);
  assert.equal(doc.querySelector('.su-root'), null);
  assert.equal(doc.querySelector('#story-suite-ui-menu'), null);
});

test('flag on at start mounts the view, hides the old furniture class and links the styles', async () => {
  const doc = page();
  const ctx = fakeCtx(true);
  const api = await startPreview({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/' });
  assert.equal(api.isOn(), true);
  assert.ok(doc.body.classList.contains('ss-ui-next'));
  assert.ok(doc.querySelector('.su-root'));
  assert.ok(doc.querySelector('#story-suite-ui-menu'));
  assert.equal(doc.head.querySelectorAll('link').length, 16);
});

test('set(true) then set(false) saves the flag and takes everything away again', async () => {
  const doc = page();
  const ctx = fakeCtx();
  const api = await startPreview({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/' });
  api.set(true);
  assert.equal(ctx.extensionSettings.storySuite.ui.next, true);
  assert.ok(doc.querySelector('.su-root'));
  api.set(true);
  assert.equal(doc.querySelectorAll('.su-root').length, 1);
  api.off();
  assert.equal(ctx.extensionSettings.storySuite.ui.next, false);
  assert.equal(ctx.saved, 3);
  assert.equal(doc.querySelector('.su-root'), null);
  assert.equal(doc.querySelector('#story-suite-ui-menu'), null);
  assert.equal(doc.body.classList.contains('ss-ui-next'), false);
  assert.equal(doc.head.querySelectorAll('link').length, 0);
});

test('the flag guards a context with no settings: read says off, write does nothing, the switch still toggles the view', async () => {
  assert.equal(readFlag(null), false);
  assert.equal(writeFlag(null, true), false);
  assert.equal(writeFlag({}, true), false);
  assert.equal(writeFlag({ extensionSettings: 'x' }, true), false);
  const ctx = { name1: 'Reader', chatMetadata: {} };
  const doc = page();
  const api = await startPreview({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/' });
  assert.doesNotThrow(() => api.set(true));
  assert.equal(api.isOn(), true);
  assert.doesNotThrow(() => api.off());
  assert.equal(api.isOn(), false);
});

test('startPreview does nothing without Story Block or the context', async () => {
  const doc = page();
  assert.equal(await startPreview({ doc, getContext: () => fakeCtx(), StoryBlock: null }), null);
  assert.equal(await startPreview({ doc, getContext: () => null, StoryBlock: fakeBlock() }), null);
});

test('startPreview takes the Story Block global the entry started, and does nothing when there is none', async () => {
  const doc = page();
  const ctx = fakeCtx();
  const savedTavern = globalThis.SillyTavern;
  const savedBlock = globalThis.StoryBlock;
  globalThis.SillyTavern = { getContext: () => ctx };
  try {
    delete globalThis.StoryBlock;
    assert.equal(await startPreview({ doc, base: 'x/' }), null, 'no host: no switch, no waiting');
    assert.equal(doc.querySelector('#story-suite-ui-next'), null);
    globalThis.StoryBlock = fakeBlock();
    assert.ok(await startPreview({ doc, base: 'x/' }));
    assert.ok(doc.querySelector('#story-suite-ui-next'));
  } finally {
    if (savedTavern === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = savedTavern;
    if (savedBlock === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = savedBlock;
  }
});

test('startPreview waits for the settings host that appears after the extension entry runs', async () => {
  const doc = page();
  const host = doc.getElementById('extensions_settings2');
  host.remove();
  const pending = startPreview({ doc, getContext: () => fakeCtx(), StoryBlock: fakeBlock(), base: 'x/' });
  await new Promise(resolve => setTimeout(resolve, 30));
  doc.body.appendChild(host);
  assert.ok(await pending);
  assert.ok(doc.querySelector('#story-suite-ui-next'));
});

test('the one manifest names the root entry and suite.css; suite.css lists the hide sheet, which names every old furniture class, scoped to the body class', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'suite.css');
  assert.equal(fs.existsSync(new URL('../../ui/manifest.json', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../../ui/st-entry.js', import.meta.url)), false);
  assert.match(fs.readFileSync(new URL('../../suite.css', import.meta.url), 'utf8'), /@import url\('\.\/ui\/css\/next-hide\.css'\)/);
  const css = fs.readFileSync(new URL('../../ui/css/next-hide.css', import.meta.url), 'utf8');
  for (const sel of ['.story-suite-bar', '.ss-cards', '.ss-hud', '.story-suite-extras', '.story-suite-reply-note']) assert.ok(css.includes(`body.ss-ui-next ${sel}`), sel);
});
