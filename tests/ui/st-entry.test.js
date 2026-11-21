import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeDom } from './helpers/dom.js';
import { startView } from '../../ui/entry/start.js';
import { buildSelectors } from '../../ui/select/build.js';

const TABS = ['card', 'now', 'chat', 'party', 'bag', 'people', 'dossier', 'world', 'journal', 'story', 'scene', 'fight', 'flags', 'settings'];

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
  return { ready: Promise.resolve(sdk), sdk, emit: (event, payload) => (listeners[event] ?? []).forEach(fn => fn(payload)) };
}

// NPC State's settings section, mounted in Extensions before the view made the Story Suite drawer.
function npcSettings(doc) {
  const node = doc.createElement('div');
  node.id = 'people_settings';
  doc.getElementById('extensions_settings2').appendChild(node);
  return node;
}

function fakeCtx(next) {
  const ctx = { extensionSettings: next === undefined ? {} : { storySuite: { ui: { next } } }, name1: 'Reader', chatMetadata: {}, saved: 0 };
  ctx.saveSettingsDebounced = () => { ctx.saved += 1; };
  return ctx;
}

test('buildSelectors has one selector per tab and never throws on empty answers', () => {
  const selectors = buildSelectors(() => null, null);
  assert.deepEqual(Object.keys(selectors).sort(), [...TABS, 'inspector', 'problems', 'roster', 'savepoints', 'history', 'sent', 'prompts'].sort());   // the Tools page's own live reads follow the tabs
  const read = () => null;
  for (const tab of [...TABS, 'inspector', 'problems', 'roster', 'savepoints', 'history', 'sent', 'prompts']) assert.doesNotThrow(() => selectors[tab](read), tab);
  assert.equal(selectors.fight(read), null);
});

test('buildSelectors builds the card and chat view-models from sdk queries', () => {
  const selectors = buildSelectors(() => ({ name1: 'Reader' }), null);
  const read = name => (name === 'party.actors' ? [{ id: 'a1', name: 'Astra', pc: true }] : name === 'scene.place' ? { name: 'Inn' } : null);
  const card = selectors.card(read);
  assert.equal(card.rpg, true);
  assert.equal(card.scene.place, 'Inn');
  // (one card per reply of the chat: the reply's own state, asked with { asOf })
  const chat = [{ is_user: true, mes: 'Hi.' }, { mes: 'The inn.' }];
  const ctxSelectors = buildSelectors(() => ({ name1: 'Reader', chat }), null);
  const vm = ctxSelectors.chat((name, args) => (args?.asOf === 1 ? read(name) : null));
  assert.equal(vm.replies[0].top.place, 'Inn');
  assert.equal(vm.head.index, 1);
  assert.equal(ctxSelectors.chat(() => null).head.actions.fight, false);
});

const start = (doc, ctx, more = {}) => startView({ doc, getContext: () => ctx, StoryBlock: fakeBlock(), base: 'x/', ...more });

test('the view mounts: styles, the "Story Suite" menu entry, no body class, no old-view switch and no preview wording', async () => {
  const doc = page();
  const api = await start(doc, fakeCtx());
  assert.equal(api.isOn(), true);
  assert.ok(doc.querySelector('.su-root'));
  assert.equal(doc.querySelector('#story-suite-ui-menu').textContent, 'Story Suite');
  assert.equal(doc.head.querySelectorAll('link').length, 21, 'one stylesheet per area, loot.css, the desktop sheet frame (sheet-desk.css), gear-stats.css and the dossier map and library (dossier-map.css) included');
  assert.equal(doc.body.classList.contains('ss-ui-next'), false, 'no class: there is no old furniture to hide');
  assert.equal(doc.querySelector('#story-suite-old-view'), null);
  assert.equal(/preview|old view/i.test(doc.body.textContent), false);
  api.stop();
  assert.equal(doc.querySelector('.su-root'), null);
  assert.equal(doc.head.querySelectorAll('link').length, 0);
});

test('a device that once chose the old view (storySuite.ui.oldView = 1) and a stored ui.next false still get the view', async () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => (key === 'storySuite.ui.oldView' ? '1' : null), setItem() {}, removeItem() {} };
  try {
    const doc = page();
    const api = await start(doc, fakeCtx(false));
    assert.equal(api.isOn(), true);
    assert.ok(doc.querySelector('.su-root'));
    assert.equal(doc.querySelector('#story-suite-old-view'), null);
  } finally {
    if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved;
  }
});

test('index.js starts the view after boot, with nothing before it; no file outside docs names ui/legacy', () => {
  const entry = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8');
  assert.match(entry, /if \(started\) await startView\(\);/);
  assert.equal(/firstPaint|ss-ui-next|flag\.js/.test(entry), false);
  for (const rel of ['../../core/boot/boot.js', '../../ui/entry/turn-on.js', '../../ui/entry/start.js']) assert.equal(fs.readFileSync(new URL(rel, import.meta.url), 'utf8').includes('ui/legacy'), false, rel);
  assert.equal(fs.existsSync(new URL('../../ui/legacy', import.meta.url)), false);
});

test('the view makes the Story Suite drawer in Extensions: title, status line, then its Settings and Open buttons; NPC State\'s settings move in', async () => {
  const doc = page();
  const npc = npcSettings(doc);
  const api = await start(doc, fakeCtx());
  const drawer = doc.querySelector('#story_suite_v2_drawer');
  assert.ok(drawer);
  assert.match(drawer.querySelector('.inline-drawer-header b').textContent, /^Story Suite \d+\.\d+\.\d+$/);
  const content = drawer.querySelector('.inline-drawer-content');
  assert.match(content.children[0].textContent, /^Story Suite \d+\.\d+\.\d+ · /);
  const row = doc.querySelector('#story-suite-next-drawer');
  assert.equal(content.children[1], row);
  assert.equal(content.children[2], npc, 'NPC State\'s section sits in the drawer, after the buttons');
  assert.deepEqual([...row.querySelectorAll('button')].map(b => b.textContent), ['Settings', 'Open Story Suite']);
  row.querySelectorAll('button')[0].click();
  assert.equal(doc.querySelector('.su-layer').getAttribute('data-state'), 'open');
  assert.ok(doc.querySelector('.su-root .shd'), 'the settings overlay opened');
  api.stop();
  assert.equal(doc.querySelector('#story-suite-next-drawer'), null, 'the buttons go with the view');
  assert.ok(doc.querySelector('#story_suite_v2_drawer'), 'the drawer stays for NPC State\'s settings');
});

test('the view does not wait for the extension settings: it mounts with no settings host and draws the drawer once the host is there', async () => {
  const doc = page();
  const host = doc.getElementById('extensions_settings2');
  host.remove();
  const block = fakeBlock();
  const api = await start(doc, fakeCtx(), { StoryBlock: block });
  assert.equal(api.isOn(), true);
  assert.ok(doc.querySelector('.su-root'));
  assert.equal(doc.querySelector('#story_suite_v2_drawer'), null);
  doc.body.appendChild(host);
  block.emit('head', { reason: 'chat' });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.ok(doc.querySelector('#story_suite_v2_drawer #story-suite-next-drawer'));
});

test('startView does nothing without Story Block or the context', async () => {
  const doc = page();
  assert.equal(await startView({ doc, getContext: () => fakeCtx(), StoryBlock: null }), null);
  assert.equal(await startView({ doc, getContext: () => null, StoryBlock: fakeBlock() }), null);
  assert.equal(doc.querySelector('.su-root'), null);
});

test('startView takes the Story Block global the entry started', async () => {
  const doc = page();
  const ctx = fakeCtx();
  const savedTavern = globalThis.SillyTavern;
  const savedBlock = globalThis.StoryBlock;
  globalThis.SillyTavern = { getContext: () => ctx };
  try {
    delete globalThis.StoryBlock;
    assert.equal(await startView({ doc, base: 'x/' }), null, 'no host: nothing drawn, no waiting');
    assert.equal(doc.querySelector('.su-root'), null);
    globalThis.StoryBlock = fakeBlock();
    assert.ok((await startView({ doc, base: 'x/' })).isOn());
  } finally {
    if (savedTavern === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = savedTavern;
    if (savedBlock === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = savedBlock;
  }
});

test('the one manifest names the root entry and suite.css; suite.css lists the font and drawer sheets and no old view sheet', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'suite.css');
  assert.equal(fs.existsSync(new URL('../../ui/manifest.json', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../../ui/st-entry.js', import.meta.url)), false);
  const css = fs.readFileSync(new URL('../../suite.css', import.meta.url), 'utf8');
  assert.match(css, /@import url\('\.\/ui\/css\/fonts\.css'\)/);
  assert.match(css, /@import url\('\.\/ui\/css\/drawer\.css'\)/);
  assert.match(css, /@import url\('\.\/ui\/css\/tokens\.css'\)/);
  assert.match(fs.readFileSync(new URL('../../ui/css/tokens.css', import.meta.url), 'utf8'), /--ss-text: var\(--SmartThemeBodyColor, CanvasText\);/, 'the battle log\'s page-level tokens');
  assert.equal(/ui\/legacy|next-hide/.test(css), false);
  assert.match(fs.readFileSync(new URL('../../ui/css/fonts.css', import.meta.url), 'utf8'), /url\('\.\.\/\.\.\/assets\/fonts\/nunito\/nunito-latin-400\.woff2'\)/);
  assert.ok(fs.existsSync(new URL('../../assets/fonts/nunito/nunito-latin-400.woff2', import.meta.url)), 'the font path resolves from ui/css');
});

test('the drawer status names each started module once and skips hidden ones (NPC State registers a hidden twin)', async () => {
  const doc = page();
  const block = fakeBlock();
  block.sdk.modules = () => [{ id: 'people', name: 'NPC State', hidden: true }, { id: 'npc', name: 'NPC State' }, { id: 'sb', name: 'Story Block' }, { id: 'sb2', name: 'Story Block' }];
  const api = await start(doc, fakeCtx(), { StoryBlock: block });
  const status = doc.querySelector('#story_suite_v2_drawer .inline-drawer-content').children[0].textContent;
  assert.match(status, / · NPC State, Story Block$/);
  api.stop();
});

test('start takes the stale storySuite.ui.oldView key away, and a storage that throws does not stop the view', async () => {
  const saved = globalThis.localStorage;
  const removed = [];
  globalThis.localStorage = { getItem: () => '1', setItem() {}, removeItem: key => removed.push(key) };
  try {
    const api = await start(page(), fakeCtx());
    assert.deepEqual(removed, ['storySuite.ui.oldView']);
    api.stop();
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() { throw new Error('storage blocked'); } };
    const again = await start(page(), fakeCtx());
    assert.equal(again.isOn(), true);
    again.stop();
  } finally {
    if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved;
  }
});
