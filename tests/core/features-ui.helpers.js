import { createHost } from '../../packages/story-block/testkit/index.js';
import { makeMessage } from '../helpers/ui-fake-dom.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { featuresFoldOf, renderSettingsHost } from '../../ui/legacy/host-ui.js';
import { CORE_FEATURE } from '../../core/features.js';
import { mountUi } from '../../ui/legacy/ui-host.js';

export const texts = (root, selector) => root.querySelectorAll(selector).map(node => node.textContent);

// Two features: one that changes the static prompt (it owns a kind), one that owns screens, a tab and a widget.
export const loot = () => ({
    id: 'loot',
    name: 'Loot',
    features: [
        { id: 'loot.picker', label: 'Loot picker', describe: 'Pick what to keep after a fight.' },
        { id: 'loot.weight', label: 'Weight', describe: 'Items weigh something.', default: false },
    ],
    capture: { kinds: { weight: { grammar: '~ weight Item | kg: 1', feature: 'loot.weight' } }, apply: () => ({ summary: 'ok', narrate: false }) },
    screens: [
        { id: 'loot/picker', title: 'Picker', mounts: ['tab', 'hud'], template: '<p class="picker">pick</p>', feature: 'loot.picker' },
        { id: 'loot/bag', title: 'Bag', mounts: ['tab'], template: '<p class="bag">bag</p>' },
    ],
    tabs: [{ id: 'loot-code', title: 'Loot code', render: el => { el.textContent = 'code'; }, feature: 'loot.picker' }],
    widgets: { 'loot.gem': { render: el => { el.textContent = 'gem'; }, feature: 'loot.picker' } },
});
// A module with settings and no features: its fold has no Features subsection.
export const plain = () => ({ id: 'plain', name: 'Plain', settings: { defaults: { on: true }, schema: { on: { type: 'bool', label: 'On' } } } });

export async function overlay(options = {}) {
    const doc = setupDom();
    const host = await createHost({ modules: [loot(), plain()], ...options });
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    const view = renderSettingsHost(root, { registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk });
    return { doc, host, root, view };
}

export const foldOf = (root, key) => root.querySelectorAll('details.story-suite-fold').find(node => node.dataset.fold === key);
export const rowsOf = node => node.querySelectorAll('.story-suite-feature');

export const subOf = (root, moduleId) => root.querySelectorAll('details.story-suite-subfold').find(node => node.dataset.fold === featuresFoldOf(moduleId));
export const subsOf = node => node.querySelectorAll('details.story-suite-subfold');
export const countOn = (host, moduleId) => {
    const own = host.features.list().filter(feature => feature.moduleId === moduleId);
    return { on: own.filter(feature => feature.on === true && feature.available !== false).length, n: own.length };
};

export async function page(options = {}) {
    const doc = setupDom();
    const form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const drawerHost = doc.createElement('div');
    drawerHost.id = 'extensions_settings';
    doc.body.appendChild(drawerHost);
    const host = await createHost({ modules: [loot()], ...options });
    const runtime = { registry: host.registry, store: host.store, sdk: host.sdk, settings: host.settings, events: host.events, turn: host.turn, features: host.features };
    const ui = mountUi({ runtime, ctx: host.ctx, doc, version: '2.0.0-test' });
    const draw = () => {
        for (const old of doc.querySelectorAll('.mes')) old.remove();
        host.ctx.chat.forEach((message, index) => makeMessage(doc, index));
    };
    return { doc, host, ui, draw };
}

export const hudTile = doc => doc.querySelector('#story_suite_v2_overlay')?.querySelectorAll('.ss-feature').find(node => node.dataset.feature === CORE_FEATURE.hud) ?? null;
export const hudRow = doc => doc.querySelector('.story-suite-hud-toggle');
