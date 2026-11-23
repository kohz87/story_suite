// A screen a plug-in module declares opens in the shared bottom sheet, drawn from its widget; closing tears it down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { createScreenSource } from '../../../core/boot/screen-source.js';
import { createPluginScreens } from '../../../ui/wizard/plugin-screen.js';
import { attachWizard } from '../../../ui/wizard/attach.js';
import { textRpgModule } from '../../../examples/text-rpg/src/module.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';

const SCREEN = 'text-rpg/new-character';

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  let host = null;
  host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
  t.after(() => host.close());
  installFakeDom();
  const doc = globalThis.document;
  const screens = createScreenSource({ registry: host.registry });
  return { host, doc, screens, sheetCtx: () => ({ doc, sheetHost: doc.body }) };
}
const type = (el, role, value) => { const box = el.querySelector(`[data-role="${role}"]`); box.value = value; box.dispatchEvent(new globalThis.Event('input')); box.dispatchEvent(new globalThis.Event('change')); };

test('the screen source finds a declared screen only while its feature is on, and nothing for an unknown id', async t => {
  const { host, screens } = await live(t);
  assert.equal(screens.find(SCREEN), null);
  host.features.set('text-rpg.on', true);
  const found = screens.find(SCREEN);
  assert.equal(found.title, 'New character');
  assert.equal(found.widget.name, 'text-rpg.new-character');
  assert.equal(typeof found.widget.render, 'function');
  assert.equal(screens.find('nobody/none'), null);
});

test('opening the screen draws the widget in a titled sheet; Create makes the character, closes the sheet and ends once', async t => {
  const { host, doc, screens, sheetCtx } = await live(t);
  host.features.set('text-rpg.on', true);
  const plugin = createPluginScreens({ screens, sdk: host.sdk, sheetCtx });
  let ended = 0;
  assert.equal(plugin.open(SCREEN, null, { onEnd: () => { ended += 1; } }), true);
  const sheet = doc.querySelector('[data-sheet="plugin-screen"]');
  assert.ok(sheet);
  assert.equal(sheet.querySelector('.sh-h h3').textContent, 'New character');
  type(sheet, 'name', 'Astra');
  for (const [key, value] of Object.entries({ str: 10, vit: 10, agi: 10, dex: 10, int: 10, wis: 5, cha: 5 })) type(sheet, `stat-${key}`, String(value));
  type(sheet, 'skill-0', 'Swordplay');
  type(sheet, 'skill-1', 'Lore');
  sheet.querySelector('[data-act="create"]').dispatchEvent(new globalThis.Event('click'));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(host.sdk.query('party.actors')?.length, 1);
  assert.equal(doc.querySelector('[data-sheet="plugin-screen"]'), null, 'closed by the made character');
  assert.equal(ended, 1);
  assert.equal(plugin.isOpen(), false);
});

test('closing the sheet runs the cleanup the widget returned; an unknown screen opens nothing', async t => {
  const { doc, screens, sheetCtx, host } = await live(t);
  host.features.set('text-rpg.on', true);
  let cleaned = 0;
  const fake = { find: id => (id === 'x/y' ? { title: 'Why', widget: { name: 'x.y', props: { a: 1 }, render: (el, props, api) => { el.textContent = `a=${props.a}`; assert.equal(typeof api.close, 'function'); return () => { cleaned += 1; }; } } } : null) };
  const plugin = createPluginScreens({ screens: fake, sdk: host.sdk, sheetCtx });
  assert.equal(plugin.open('nobody/none'), false);
  assert.equal(createPluginScreens({ screens, sdk: host.sdk, sheetCtx }).open('x/y'), false);
  assert.equal(plugin.open('x/y'), true);
  assert.equal(doc.querySelector('[data-sheet="plugin-screen"] .sh-body').textContent, 'a=1');
  plugin.close();
  assert.equal(cleaned, 1);
  assert.equal(doc.querySelector('[data-sheet="plugin-screen"]'), null);
});

test('the view\'s opener answers a plug-in screen, false while its feature is off, and false for a screen no module declares', async t => {
  const { host, doc, screens } = await live(t);
  const suite = { isOpen: () => true, open() {}, root: doc.body, backStack: null };
  const wiz = attachWizard({ doc, ctx: () => null, sdk: host.sdk, suite, screens });
  assert.equal(wiz.open(SCREEN, null), false);
  host.features.set('text-rpg.on', true);
  assert.equal(wiz.open(SCREEN, null), true);
  assert.equal(wiz.open('nobody/none', null), false);
  wiz.destroy();
  assert.equal(doc.querySelector('[data-sheet="plugin-screen"]'), null);
});
