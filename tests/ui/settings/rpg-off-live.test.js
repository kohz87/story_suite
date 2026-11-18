// Settings on a live host with the RPG off (the owner's report, 18 Nov): the RPG and fights page is not listed, and comes back when the RPG is
// switched on from Start with Settings open (and goes again when switched off), its stored values kept; a module card's "Settings ›" link is drawn
// only when the module has a page, and goes to it (Story Block has none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';

const RPG = 'story-block.rpg';
const settled = () => new Promise(resolve => setTimeout(resolve, 0)); // the port's command answers in a promise; the side list is read after it

async function mounted(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, selectors: buildSelectors(() => null, host.sdk), rpgValues: () => host.sdk.settings('story-block') });
  installFakeDom();
  const document = globalThis.document;
  const overlay = createSettingsOverlay({
    doc: document, host: document.body, settings: port.view('settings'), renderSection: renderSettingsSection,
    onChange: (key, value) => port.command('settings.set', { key, value }), onAction: (key, value) => port.command('settings.action', { key, value }), onView: (name, args) => port.view(name, args),
  });
  overlay.open('start');
  const listed = () => overlay.el.querySelectorAll('.snav [data-sec]').map(b => b.getAttribute('data-sec'));
  const phone = () => overlay.el.querySelectorAll('.phonelist [data-sec]').map(b => b.getAttribute('data-sec'));
  const card = id => overlay.el.querySelector(`.mod[data-mod="${id}"]`);
  return { host, port, overlay, listed, phone, card };
}

test('RPG off: no RPG and fights page in the view-model, the side list, the phone list or search', async t => {
  const { host, port, overlay, listed, phone } = await mounted(t);
  assert.equal(host.sdk.features().find(f => f.id === RPG).on, false);
  const vm = port.view('settings');
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  assert.equal(vm.sections.some(s => s.id === 'rpg'), false);
  assert.equal(listed().includes('rpg'), false);
  assert.equal(phone().includes('rpg'), false);
  assert.ok(listed().includes('people') && listed().includes('director'), listed().join());
  overlay.setQuery('Level cap');
  assert.equal(overlay.el.querySelectorAll('.srow[data-key="rpg.levelCap"]').length, 0, 'search finds no RPG row');
});

test('switching the RPG on from Start lists the page with its stored values; off takes it away again', async t => {
  const { host, overlay, listed, port } = await mounted(t);
  host.settings.set('story-block', 'rpgLevelCap', 12);
  const sw = () => overlay.el.querySelector(`[data-sub="story-block:${RPG}"]`);
  // the Story Block card's features are folded: open them, then switch the RPG on
  overlay.el.querySelector('.mod[data-mod="story-block"] .mf .lnk').click();
  sw().click();
  await settled();
  assert.equal(host.sdk.features().find(f => f.id === RPG).on, true);
  assert.ok(listed().includes('rpg'), listed().join());
  assert.equal(overlay.show('rpg'), true);
  assert.equal(overlay.el.querySelector('.srow[data-key="rpg.levelCap"] input').value, '12');
  assert.equal(port.view('settings').sections.find(s => s.id === 'rpg').rows.find(r => r.key === 'rpg.levelCap').value, 12);
  // off again (from Start): the page goes, the stored value stays
  overlay.show('start'); // the card's features stay open
  sw().click();
  await settled();
  assert.equal(host.sdk.features().find(f => f.id === RPG).on, false);
  assert.equal(listed().includes('rpg'), false);
  assert.equal(overlay.show('rpg'), false);
  assert.equal(host.sdk.settings('story-block').rpgLevelCap, 12);
});

test('a module card links "Settings ›" only to a page that exists, and the link opens it', async t => {
  const { overlay, card } = await mounted(t);
  const link = id => card(id)?.querySelectorAll('.mf .lnk').find(b => b.textContent === 'Settings ›') ?? null;
  assert.ok(card('story-block'), 'the Story Block card is drawn');
  assert.equal(link('story-block'), null, 'Story Block has no settings page of its own');
  const director = link('story-director');
  assert.ok(director, 'Story Director links to its page');
  assert.equal(director.getAttribute('data-sec'), 'director');
  director.click();
  assert.equal(overlay.el.querySelector('.snav [aria-current="true"]').getAttribute('data-sec'), 'director');
  overlay.show('start');
  for (const b of overlay.el.querySelectorAll('.mods .mf .lnk').filter(x => x.textContent === 'Settings ›')) {
    assert.ok(overlay.el.querySelector(`.snav [data-sec="${b.getAttribute('data-sec')}"]`), `"Settings ›" to ${b.getAttribute('data-sec')} has a page`);
  }
});
