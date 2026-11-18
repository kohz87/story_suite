// Start on a live host: the module cards' icon, description, off line and token figure, and the three presets (Lean, Standard, Full) that apply through the port and redraw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { storyDirectorModule } from '../../../../modules/director/module.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { createToolsHandle } from '../../../../ui/port/tools-handle.js';
import { buildSelectors } from '../../../../ui/select/build.js';
import { selectSettings } from '../../../../ui/select/settings.js';
import { CARD_TEXT } from '../../../../ui/select/module-text.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../../ui/contract/settings.js';
import { staticTextWith, estimateTokens } from '../../../../core/prompt.js';
import { presetSwitches } from '../../../../core/features.js';
import { FEATURES as NPC_FEATURES } from '../../../../modules/people/meters/npc-meters-config-parts/features.js';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';

async function live(t, { withTools = true } = {}) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const tools = withTools ? createToolsHandle({ runtime: host, ui: () => null }) : null;
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value), keep() {}, kept: () => null }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, tools, selectors: buildSelectors(() => null, host.sdk, tools) });
  const doc = installFakeDom();
  const ov = createSettingsOverlay({
    doc, settings: port.view('settings'), renderSection: renderSettingsSection,
    onChange: (k, v) => port.command('settings.set', { key: k, value: v }), onAction: (k, v) => port.command('settings.action', { key: k, value: v }), onView: (n, a) => port.view(n, a),
  });
  ov.open('start');
  const page = () => { ov.show('start'); return ov.el.querySelector('.spage'); };
  return { host, port, page };
}
const tokens = (host, switches = new Map()) => estimateTokens(staticTextWith(host.registry, switches));
const card = (el, id) => el.querySelector(`.mod[data-mod="${id}"]`);
const settle = () => new Promise(r => setTimeout(r, 0));

test('the Story Block and Story Director cards show their icon, description and the engine’s token figure; never ≈ 0', async t => {
  const { host, port, page } = await live(t);
  const vm = port.view('settings');
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  const el = page();
  for (const id of ['story-block', 'story-director']) {
    const def = vm.modules.defs.find(d => d.id === id);
    const off = new Map(def.subs.map(s => [s.key, false]));
    const want = tokens(host) - tokens(host, off);
    assert.ok(want > 0, id);
    assert.equal(def.tokens, want, id);
    assert.equal(card(el, id).querySelector('.mi').textContent, CARD_TEXT[id].icon);
    assert.equal(card(el, id).querySelector('.mt small').textContent, CARD_TEXT[id].desc);
    assert.match(card(el, id).querySelector('.mc').textContent, new RegExp(`^\\d+ of ${def.subs.length} on · ≈ ${want.toLocaleString('en-US')} tokens$`));
  }
  assert.ok(!el.textContent.includes('≈ 0 tokens'));
});

test('a card switched off shows its off line and "off"', async t => {
  const { page } = await live(t);
  card(page(), 'story-director').querySelector('.mh .sw').click();
  await settle();
  const el = page();
  assert.equal(card(el, 'story-director').querySelector('.mc').textContent, 'off');
  assert.equal(card(el, 'story-director').querySelector('.mt small').textContent, CARD_TEXT['story-director'].off);
});

test('the three presets show what each turns on and the fixed prompt each would send; Standard is today’s', async t => {
  const { host, page } = await live(t);
  const el = page();
  const tiles = el.querySelectorAll('.pre');
  assert.deepEqual(tiles.map(b => b.querySelector('b').textContent), ['Lean', 'Standard', 'Full']);
  const list = host.sdk.features();
  const n = ['lean', 'standard', 'full'].map(name => tokens(host, presetSwitches(list, name)));
  assert.ok(n[0] < n[1] && n[1] < n[2], String(n));
  assert.equal(n[1], tokens(host));
  tiles.forEach((b, i) => assert.equal(b.querySelector('em').textContent, `≈ ${n[i].toLocaleString('en-US')} tokens of rules each reply`));
  tiles.forEach(b => assert.ok(b.querySelector('small').textContent.length > 20));
  assert.equal(el.querySelector('.pre[aria-pressed="true"] b').textContent, 'Standard');
});

test('picking Lean writes the Lean switches through the port, and the page redraws from the host at once', async t => {
  const { host, port, page } = await live(t);
  const before = card(page(), 'story-director').querySelector('.mc').textContent;
  page().querySelector('.pre[data-pre="lean"]').click();
  await settle();
  const want = presetSwitches(host.sdk.features(), 'lean');
  for (const f of host.sdk.features()) if (want.has(f.id)) assert.equal(f.on === true, want.get(f.id), f.id);
  const el = page();
  assert.equal(el.querySelector('.pre[aria-pressed="true"] b').textContent, 'Lean');
  assert.notEqual(card(el, 'story-director').querySelector('.mc').textContent, before);
  const sd = port.view('settings').modules.defs.find(d => d.id === 'story-director');
  const now = tokens(host) - tokens(host, new Map(sd.subs.map(s => [s.key, false])));
  assert.match(card(el, 'story-director').querySelector('.mc').textContent, new RegExp(` · ≈ ${now.toLocaleString('en-US')} tokens$`), 'the figure follows the preset');
  el.querySelector('.pre[data-pre="full"]').click();
  await settle();
  assert.equal(host.sdk.features().find(f => f.id === 'story-block.choices').on, true);
  assert.equal(page().querySelector('.pre[aria-pressed="true"] b').textContent, 'Full');
});

test('one card switch changes the card’s token figure at once', async t => {
  const { host, port, page } = await live(t);
  const figure = () => card(page(), 'story-director').querySelector('.mc').textContent;
  const before = figure();
  card(page(), 'story-director').querySelector('.lnk').click();
  page().querySelector('[data-sub="story-director:story-director.threads"]').click();
  await settle();
  assert.equal(host.sdk.features().find(f => f.id === 'story-director.threads').on, false);
  const sd = port.view('settings').modules.defs.find(d => d.id === 'story-director');
  const want = tokens(host) - tokens(host, new Map(sd.subs.map(s => [s.key, false])));
  assert.notEqual(figure(), before);
  assert.match(figure(), new RegExp(`^${sd.subs.filter(s => s.on).length} of 12 on · ≈ ${want.toLocaleString('en-US')} tokens$`));
  assert.equal(page().querySelector('.pre[aria-pressed="true"]'), null, 'Custom');
});

test('an unknown preset is refused and switches nothing', async t => {
  const { host, port } = await live(t);
  const was = host.sdk.features().map(f => f.on);
  assert.equal((await port.command('settings.action', { key: 'modules.preset', value: 'huge' })).ok, false);
  assert.deepEqual(host.sdk.features().map(f => f.on), was);
});

test('with no engine count (no tools handle) the cards and presets show no figure rather than 0', async t => {
  const { page } = await live(t, { withTools: false });
  const el = page();
  assert.match(card(el, 'story-block').querySelector('.mc').textContent, /^\d+ of \d+ on$/);
  assert.equal(el.querySelectorAll('.pre').length, 3);
  assert.equal(el.querySelectorAll('.pre em').length, 0);
});

test('the NPC State card carries its icon, description and off line from its real feature list', () => {
  const features = NPC_FEATURES.map(f => ({ ...f, on: f.default !== false, moduleId: 'npc-state-delta', moduleName: 'NPC State' }));
  const def = selectSettings({ features, staticTokens: sw => (sw.size ? 100 : 400) }).modules.defs.find(d => d.id === 'npc-state-delta');
  assert.deepEqual([def.icon, def.desc, def.off, def.tokens, def.section], [CARD_TEXT['npc-state-delta'].icon, CARD_TEXT['npc-state-delta'].desc, CARD_TEXT['npc-state-delta'].off, 300, 'people']);
});
