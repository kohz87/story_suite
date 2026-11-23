// "Instead of this plug-in": the Text RPG page switches the RPG it replaces, and its Start card lists "RPG (built-in)"; both write the normal feature, so `replaces` flips the other off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';
import { textRpgModule } from '../../../examples/text-rpg/src/module.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { selectPluginPages } from '../../../ui/select/plugin-pages.js';

async function live(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
    t.after(() => host.close());
    const tools = createToolsHandle({ runtime: host });
    const selectors = buildSelectors(() => null, host.sdk, tools);
    const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, tools, selectors, rpgValues: () => host.sdk.settings('story-block') });
    return { host, port };
}
const sections = port => port.view('settings').sections;
const KEY = 'plugin.text-rpg.replaces.story-block.rpg';

test('the Text RPG page opens with an RPG switch in its own group, and the RPG page is hidden while the RPG is off', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    const page = sections(port).find(s => s.id === 'plugin-text-rpg');
    assert.equal(page.rows[0].group, 'Instead of this plug-in');
    assert.deepEqual([page.rows[0].key, page.rows[0].label, page.rows[0].type, page.rows[0].value], [KEY, 'RPG', 'sw', false]);
    assert.match(page.rows[0].hint, /\S/);
    assert.equal(page.rows.filter(r => r.group === 'Instead of this plug-in').length, 1);
    assert.ok(!sections(port).some(s => s.id === 'rpg'));
});

test('switching the RPG on turns Text RPG off, shows the RPG and fights page; the card sub turns the RPG off again', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    assert.deepEqual(await port.command('settings.set', { key: KEY, value: true }), { ok: true, value: true });
    assert.equal(host.features.on('story-block.rpg'), true);
    assert.equal(host.features.on('text-rpg.on'), false);
    assert.ok(sections(port).some(s => s.id === 'rpg'));
    assert.ok(!sections(port).some(s => s.id === 'plugin-text-rpg'), 'the plug-in page goes with the plug-in');
    // Text RPG on again from its Start card: the RPG goes off.
    assert.equal((await port.command('settings.set', { key: 'modules.chat.text-rpg.text-rpg.on', value: true })).ok, true);
    assert.equal(host.features.on('story-block.rpg'), false);
    assert.equal(host.features.on('text-rpg.on'), true);
    assert.ok(!sections(port).some(s => s.id === 'rpg'));
});

test('the Start card lists "RPG (built-in)" and its switch writes the RPG', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    const start = () => port.view('settings').modules;
    const card = start().defs.find(d => d.id === 'text-rpg');
    const sub = card.subs.find(s => s.key === 'story-block.rpg');
    assert.equal(sub.label, 'RPG (built-in)');
    assert.equal(start().chat['text-rpg'].subs['story-block.rpg'], false);
    assert.equal(start().chat['text-rpg'].on, true, 'the card keeps its own state');
    assert.equal((await port.command('settings.set', { key: 'modules.chat.text-rpg.story-block.rpg', value: true })).ok, true);
    assert.equal(host.features.on('text-rpg.on'), false);
    assert.equal(host.features.on('story-block.rpg'), true);
    assert.equal((await port.command('settings.set', { key: 'modules.chat.text-rpg.nope', value: true })).ok, false);
});

test('a key that is not a replaced feature, or a non-boolean value, is refused; a module that replaces nothing gets no group', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    assert.equal((await port.command('settings.set', { key: 'plugin.text-rpg.replaces.story-block.gear', value: true })).ok, false);
    assert.equal((await port.command('settings.set', { key: KEY, value: 'yes' })).ok, false);
    assert.equal(host.features.on('story-block.rpg'), false);
    const own = selectPluginPages([{ id: 'p', settingsPage: { section: 'P', schema: { a: { type: 'bool' } }, defaults: {} } }], [{ moduleId: 'p', on: true }], {})[0];
    assert.ok(!own.rows.some(r => r.group === 'Instead of this plug-in'));
});

test('the open overlay reads the page list again after the "Instead of this plug-in" switch', () => {
    const sec = (id, name) => ({ id, group: 'Rules', name, desc: '', special: null, rows: [] });
    let sections = [sec('start', 'Start'), sec('plugin-text-rpg', 'Text RPG')];
    const doc = installFakeDom();
    let ctx = null;
    const ov = createSettingsOverlay({ doc, settings: { sections }, onView: () => ({ sections }), onChange: () => ({ ok: true }), renderSection: (section, c) => { ctx = c; return null; } });
    const ids = () => [...ov.el.querySelectorAll('.snav [data-sec]')].map(e => e.getAttribute('data-sec'));
    assert.ok(ids().includes('plugin-text-rpg'));
    sections = [sec('start', 'Start'), sec('rpg', 'RPG and fights')];
    ctx.onChange(KEY, true);
    assert.deepEqual(ids().filter(i => i !== 'start'), ['rpg']);
});
