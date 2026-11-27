// "Instead of this plug-in": the Text RPG page switches the RPG it replaces and writes the normal feature, so `replaces` flips the other off; Start reads the truth at once.
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

test('switching the RPG on turns Text RPG off, shows the RPG and fights page; Text RPG on from its card turns the RPG off again', async t => {
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

test('the plug-in Start card has no "RPG (built-in)" sub, its card follows its own switch, and the sub key is refused', async t => {
    const { host, port } = await live(t);
    host.features.set('text-rpg.on', true);
    const start = () => port.view('settings').modules;
    const card = start().defs.find(d => d.id === 'text-rpg');
    assert.ok(!card.subs.some(s => s.key === 'story-block.rpg' || /built-in/.test(s.label)));
    assert.equal('story-block.rpg' in start().chat['text-rpg'].subs, false);
    assert.equal((await port.command('settings.set', { key: 'modules.chat.text-rpg.story-block.rpg', value: true })).ok, false);
    assert.equal(host.features.on('story-block.rpg'), false);
    await port.command('settings.set', { key: KEY, value: true });
    assert.equal(start().chat['text-rpg'].on, false, 'after the RPG switch the card reads off');
}
);

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

test('the Settings page reads the switches again when the reader moves to another page: Start shows Text RPG off after the Instead switch', async () => {
    const mk = on => ({ chat: { 'text-rpg': { on, subs: { a: on } } }, newChats: {}, scope: 'chat', preset: null, presets: [], defs: [{ id: 'text-rpg', name: 'Text RPG', section: 'start', subs: [{ key: 'a', label: 'A', hint: '', on }] }] });
    const doc = installFakeDom();
    let state = mk(true);
    const { createPages } = await import('../../../ui/settings/page.js');
    const pg = createPages({ sections: [], modules: state }, { doc, repaint() {}, view: () => ({ modules: state }), onChange: () => ({ ok: true }) });
    const text = () => pg.body({ id: 'start', special: 'start', name: 'Start', rows: [] }).map(n => n?.textContent ?? '').join(' ');
    pg.page({ id: 'plugin-text-rpg', name: 'Text RPG', desc: '', rows: [] });
    assert.match(text(), /1 of 1 on/);
    state = mk(false);
    pg.page({ id: 'start', name: 'Start', desc: '', rows: [] });
    assert.match(text(), /off/);
    assert.doesNotMatch(text(), /1 of 1 on/);
}
);
