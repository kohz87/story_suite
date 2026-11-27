// A plug-in that replaces the RPG (Text RPG): gear still works, the Party tab shows, its page carries the bag switches, its card has an icon, a number input sends numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { textRpgModule } from '../../../examples/text-rpg/src/module.js';
import { fishingModule } from '../../../examples/fishing/src/module-parts/definition.js';
import { selectPluginPages } from '../../../ui/select/plugin-pages.js';
import { gearOn } from '../../../modules/inventory/state.js';
import { definitionProblems } from '../../../core/registry/registry-checks-parts/problems.js';

async function live(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
    t.after(() => host.close());
    const tools = createToolsHandle({ runtime: host });
    const selectors = buildSelectors(() => null, host.sdk, tools);
    const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, tools, selectors, rpgValues: () => host.sdk.settings('story-block') });
    return { host, port, selectors };
}

test('A: the tab strip flags the Party tab when party.newCharacter names a screen, not otherwise', () => {
    const answers = { actors: null, screen: null };
    const read = name => (name === 'party.actors' ? answers.actors : name === 'party.newCharacter' ? answers.screen : null);
    const flags = buildSelectors(() => null, null, null).flags;
    assert.equal(flags(read).rpg, false);
    answers.screen = 'text-rpg/new-character';
    assert.equal(flags(read).rpg, true);
    answers.screen = 'x'.repeat(81);
    assert.equal(flags(read).rpg, false);
    answers.screen = null; answers.actors = [{ id: 'a', name: 'A' }];
    assert.equal(flags(read).rpg, true);
});

test('B: gear stays on with the RPG off while a feature that replaces the RPG is on', async t => {
    const { host } = await live(t);
    host.features.set('story-block.gear', true);
    assert.equal(host.sdk.query('gear.view', { id: 'you' }), null);
    host.features.set('text-rpg.on', true);
    assert.equal(host.sdk.feature('story-block.rpg'), false);
    assert.equal(host.sdk.query('gear.view', { id: 'you' }).on, true);
    host.features.set('text-rpg.on', false);
    assert.equal(host.sdk.query('gear.view', { id: 'you' }), null);
});

test('B: gearOn counts the RPG or its stand-in, and the gear switch itself', () => {
    const ctx = (on, stands) => ({ feature: id => on.includes(id), featureOrReplacement: id => stands.includes(id) });
    assert.equal(gearOn(ctx(['story-block.gear', 'story-block.rpg'], [])), true);
    assert.equal(gearOn(ctx(['story-block.gear'], ['story-block.rpg'])), true);
    assert.equal(gearOn(ctx(['story-block.gear'], [])), false);
    assert.equal(gearOn(ctx([], ['story-block.rpg'])), false);
    assert.equal(gearOn({ feature: id => id === 'story-block.gear' }), false);
});

test('C: the Text RPG page carries the three bag switches under Bag and gear, and a switch writes the same feature', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    const page = port.view('settings').sections.find(s => s.id === 'plugin-text-rpg');
    const bag = page.rows.filter(r => r.group === 'Bag and gear');
    assert.deepEqual(bag.map(r => r.key), ['rpg.pickWhatYouTake', 'rpg.encumbered', 'rpg.gearInFights']);
    assert.equal(bag.find(r => r.key === 'rpg.gearInFights').label, 'Gear');
    const before = host.features.on('story-block.gear');
    assert.equal((await port.command('settings.set', { key: 'rpg.gearInFights', value: !before })).ok, true);
    assert.equal(host.features.on('story-block.gear'), !before);
    const own = selectPluginPages([{ id: 'p', settingsPage: { section: 'P', schema: { a: { type: 'bool' } }, defaults: {} } }], [{ moduleId: 'p', on: true }], {})[0];
    assert.ok(!own.rows.some(r => r.group === 'Bag and gear'), 'no replaces, no bag rows');
});

test('D: a module icon is kept in sdk.modules(), shown on its Start card, and checked', async t => {
    const { host, port } = await live(t);
    const icons = Object.fromEntries(host.sdk.modules().filter(m => m.icon).map(m => [m.id, m.icon]));
    assert.deepEqual(icons, { 'text-rpg': 'fa-dice-d20' });
    assert.equal(fishingModule().icon, 'fa-fish');
    assert.ok(!definitionProblems(fishingModule()).some(problem => /icon/.test(problem)));
    host.features.set('text-rpg.on', true);
    const cards = port.view('settings').sections.find(s => s.id === 'start');
    assert.ok(cards);
    installFakeDom();
    const doc = globalThis.document;
    const overlay = createSettingsOverlay({ doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: () => ({ ok: true }), onAction: () => ({ ok: true }), onView: (name, args) => port.view(name, args) });
    overlay.open();
    overlay.show('start');
    const glyphs = [...overlay.el.querySelectorAll('.mi i')].map(i => i.getAttribute('class'));
    assert.deepEqual(glyphs, ['fa-solid fa-dice-d20']);
    const base = { id: 'x', name: 'X', version: '0.0.1' };
    assert.deepEqual(definitionProblems({ ...base, icon: 'fa-dice-d20' }), []);
    for (const bad of ['dice', 'fa-', 'fa-Dice', 5, 'fa-' + 'a'.repeat(38)]) assert.equal(definitionProblems({ ...base, icon: bad }).length, 1, String(bad));
});

test('E: the number input of a plug-in page sends a number', async t => {
    const typed = { id: 'typed', name: 'Typed', version: '0.0.1', features: [{ id: 'typed.on', label: 'Typed', default: true }], settings: { section: 'Typed', defaults: { count: 3 }, schema: { count: { type: 'int', label: 'Count', min: 1, max: 9 } } } };
    const host = await createHost({ core: true, modules: [...BUILTIN_MODULES, typed] });
    t.after(() => host.close());
    const tools = createToolsHandle({ runtime: host });
    const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, tools, selectors: buildSelectors(() => null, host.sdk, tools), rpgValues: () => host.sdk.settings('story-block') });
    installFakeDom();
    const doc = globalThis.document;
    const sent = [];
    const overlay = createSettingsOverlay({ doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: async (key, value) => { sent.push([key, value]); return port.command('settings.set', { key, value }); }, onAction: () => ({ ok: true }), onView: (name, args) => port.view(name, args) });
    overlay.open();
    overlay.show('plugin-typed');
    const box = overlay.el.querySelector('input[type="number"]');
    box.value = '5';
    box.dispatchEvent(new globalThis.Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(sent, [['plugin.typed.count', 5]]);
    assert.equal(host.sdk.settings('typed').count, 5);
});

test('D: the Text RPG page carries the module icon (selected from sdk.modules()), a page without one does not', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    assert.equal(port.view('settings').sections.find(s => s.id === 'plugin-text-rpg').icon, 'fa-dice-d20');
    const plain = selectPluginPages([{ id: 'p', settingsPage: { section: 'P', schema: { a: { type: 'bool' } }, defaults: {} } }], [{ moduleId: 'p', on: true }], {})[0];
    assert.equal('icon' in plain, false);
});
