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
    assert.ok(!ids(port).includes('text-rpg'));
    host.features.set('text-rpg.on', true);
    const page = port.view('settings').sections.find(s => s.id === 'text-rpg');
    assert.deepEqual([page.name, page.group], ['Text RPG', 'Rules']);
    assert.deepEqual(page.rows.map(r => r.label), ['Tone', 'Survival (hunger, thirst and warmth)', 'Stat names, in order']);
    host.features.set('text-rpg.on', false);
    assert.ok(!ids(port).includes('text-rpg'));
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
