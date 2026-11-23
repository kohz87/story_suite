// A plug-in's Rules page: it appears while the plug-in's feature is on, is named by the settings section, writes the module's setting; the Start page keeps the RPG switch.
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
import { pluginCommand } from '../../../ui/port/plugin-settings.js';
import { selectPluginPages } from '../../../ui/select/plugin-pages.js';

async function live(t, withPlugin) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const extra = withPlugin ? [textRpgModule({ feature: id => host.sdk.feature(id) })] : [];
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, ...extra] });
    t.after(() => host.close());
    const writes = { settings: host.settings, features: host.features };
    const tools = createToolsHandle({ runtime: host });
    const port = createSbPort({ sdk: host.sdk, writes, tools, selectors: buildSelectors(() => null, host.sdk, tools), rpgValues: () => host.sdk.settings('story-block') });
    return { host, port };
}
const ids = port => port.view('settings').sections.map(s => s.id);

test('the Text RPG page is there only while Text RPG is on, under Rules, with its three settings', async t => {
    const { host, port } = await live(t, true);
    assert.ok(!ids(port).includes('plugin-text-rpg'));
    host.features.set('text-rpg.on', true);
    const page = port.view('settings').sections.find(s => s.id === 'plugin-text-rpg');
    assert.deepEqual([page.name, page.group], ['Text RPG', 'Rules']);
    // (and the three bag switches the RPG page would carry, as Text RPG replaces the RPG)
    assert.deepEqual(page.rows.filter(r => r.group !== 'Bag and gear').map(r => r.label), ['Tone', 'Survival (hunger, thirst and warmth)', 'Stat names, in order']);
    host.features.set('text-rpg.on', false);
    assert.ok(!ids(port).includes('plugin-text-rpg'));
});

test('a row of the plug-in page writes the module setting; the RPG page is gone while Text RPG replaced the RPG', async t => {
    const { host, port } = await live(t, true);
    host.features.set('story-block.rpg', true);
    host.features.set('text-rpg.on', true);
    assert.ok(!ids(port).includes('rpg'));
    assert.deepEqual((await port.command('settings.set', { key: 'plugin.text-rpg.tone', value: 'Gritty (one step harder, injuries likelier)' })).ok, true);
    assert.equal(host.sdk.settings('text-rpg').tone, 'gritty');
    assert.equal((await port.command('settings.set', { key: 'plugin.text-rpg.survival', value: true })).ok, true);
    assert.equal(host.sdk.settings('text-rpg').survival, true);
    assert.equal((await port.command('settings.set', { key: 'plugin.text-rpg.nope', value: 1 })).ok, false);
});

test('the Start page draws the RPG switch (in the Story Block card) and a switch on it turns Text RPG off', async t => {
    const { host, port } = await live(t, true);
    installFakeDom();
    const doc = globalThis.document;
    const overlay = createSettingsOverlay({ doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: () => ({ ok: true }), onAction: () => ({ ok: true }), onView: (name, args) => port.view(name, args) });
    overlay.open();
    overlay.show('start');
    for (const b of overlay.el.querySelectorAll('.mf button.lnk')) if (/Features/.test(b.textContent)) b.click();
    const keys = [...overlay.el.querySelectorAll('[data-sub]')].map(e => e.getAttribute('data-sub'));
    assert.ok(keys.includes('story-block:story-block.rpg'));
    assert.ok(keys.includes('text-rpg:text-rpg.on'));
    host.features.set('text-rpg.on', true);
    host.features.set('story-block.rpg', true);
    assert.equal(host.features.on('text-rpg.on'), false);
});

test('a host without the plug-in has no extra page', async t => {
    const { port } = await live(t, false);
    assert.deepEqual(ids(port), ['start', 'look', 'people', 'world', 'director', 'money', 'extras', 'models', 'packs', 'addons', 'tools', 'help']);
});

const typed = {
    id: 'typed', name: 'Typed', version: '0.0.1', features: [{ id: 'typed.on', label: 'Typed', default: true }],
    settings: { section: 'Typed', defaults: { flag: false, count: 3, note: '' }, schema: { flag: { type: 'bool', label: 'Flag' }, count: { type: 'int', label: 'Count', min: 1, max: 9 }, note: { type: 'text', label: 'Note' } } },
};

test('a plug-in page write is checked by the field type', async t => {
    const host = await createHost({ core: true, modules: [...BUILTIN_MODULES, typed] });
    t.after(() => host.close());
    const modules = () => host.sdk.modules();
    const set = (key, value) => pluginCommand('settings.set', { key: `plugin.typed.${key}`, value }, { settings: host.settings }, modules);
    for (const bad of ['banana', 1, null]) assert.equal(set('flag', bad).ok, false);
    assert.equal(set('flag', true).ok, true);
    for (const bad of ['5', 2.5, NaN, Infinity, 0, 10, null]) assert.equal(set('count', bad).ok, false, String(bad));
    assert.equal(set('count', 9).ok, true);
    assert.equal(host.sdk.settings('typed').count, 9);
    for (const bad of [{ a: 1 }, 5, null]) assert.equal(set('note', bad).ok, false);
    assert.equal(set('note', 'x'.repeat(201)).ok, false);
    assert.match(set('note', 'x'.repeat(201)).message, /200/);
    assert.equal(set('note', 'x'.repeat(200)).ok, true);
});

test('a plug-in page id is plugin-<module id>, and the Start card links to it', async t => {
    const { host, port } = await live(t, true);
    host.features.set('text-rpg.on', true);
    assert.ok(ids(port).includes('plugin-text-rpg') && !ids(port).includes('text-rpg'));
    const clash = { id: 'look', settingsPage: typed.settings };
    const sections = selectPluginPages([clash], [{ moduleId: 'look', on: true }], {}).map(s => s.id);
    assert.deepEqual(sections, ['plugin-look']);
    installFakeDom();
    const doc = globalThis.document;
    const overlay = createSettingsOverlay({ doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection, onChange: () => ({ ok: true }), onAction: () => ({ ok: true }), onView: (name, args) => port.view(name, args) });
    overlay.open();
    overlay.show('start');
    const links = [...overlay.el.querySelectorAll('.mf button.lnk[data-sec]')].map(b => b.getAttribute('data-sec'));
    assert.ok(links.includes('plugin-text-rpg') && !links.includes('text-rpg'), links.join());
});
