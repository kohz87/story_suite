// Shared fixtures and helpers for the settings-window test suite.
import { createHost } from '../../../testkit/index.js';
import { setupDom } from '../view/mounts/helpers.js';
import { openSettingsWindow } from '../../../ui/legacy/view/settings/window.js';

export const texts = (root, selector) => root.querySelectorAll(selector).map(node => node.textContent);

export const loot = () => ({
    id: 'loot',
    name: 'Loot',
    features: [
        { id: 'loot.picker', label: 'Loot picker', describe: 'Pick what to keep after a fight.' },
        { id: 'loot.weight', label: 'Weight', describe: 'Items weigh something.', default: false },
    ],
});
// A module with settings in two groups, a field that says how many silver a penny is worth, and a list.
export const rpg = () => ({
    id: 'rpg-battle',
    name: 'RPG Battle',
    settings: {
        defaults: { hardMode: false, level: 5, title: 'Hero' },
        schema: {
            hardMode: { type: 'bool', label: 'Hard mode', help: 'Foes hit harder.' },
            level: { type: 'int', min: 1, max: 30, label: 'Starting level' },
            title: { type: 'text', label: 'Trade: Shop title' },
        },
    },
});

// The reader's tab order (ui-host.js tabsControl) as the Tabs fold reads it.
export const tabsControl = () => ({
    rows: () => [{ id: 'story-block/home', title: 'Home', icon: 'fa-house', where: ['screen'], fixed: true, hidden: false }, { id: 'story-block/scene', title: 'Scene', icon: 'fa-map', where: ['tab'], hidden: false }],
    move() {}, setHidden() {}, reset() {}, isDefault: () => true,
});

export async function open(options = {}) {
    const doc = setupDom();
    const host = await createHost({ modules: [loot(), rpg()], ...(options.host ?? {}) });
    const win = openSettingsWindow({ registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk, tabs: tabsControl(), openState: new Map(), ...(options.window ?? {}) });
    return { doc, host, win, root: win.root };
}
// The Diagnostics page's code is fetched when the page is first shown (bodies.js): show it (back to the page it was on) and wait until it has drawn.
export async function diagnosticsDrawn(root, win = null) {
    const before = win?.section?.();
    if (win) win.select('diagnostics');
    for (let waited = 0; waited < 200 && !page(root, 'diagnostics').querySelector('.ss-diagnostics'); waited += 1) await new Promise(resolve => setTimeout(resolve, 5));
    if (win && before) win.select(before);
}
export const page = (root, id) => root.querySelectorAll('.ss-settings-page').find(node => node.dataset.ssSection === id);
export const foldsOf = (root, id) => page(root, id).querySelectorAll('details.story-suite-fold').map(node => node.dataset.fold);
export const foldAt = (root, key) => root.querySelectorAll('details.story-suite-fold, details.story-suite-subfold').find(node => node.dataset.fold === key);
export const cardOf = (root, id) => root.querySelectorAll('.ss-module-card').find(node => node.dataset.module === id);
export const railItems = root => root.querySelectorAll('.ss-tabs-item');
export const shownPages = root => root.querySelectorAll('.ss-settings-page').filter(node => !node.hidden).map(node => node.dataset.ssSection);
export const search = (root, text) => {
    const input = root.querySelector('.ss-search-input');
    input.value = text;
    input.dispatch('input');
};
export const status = root => root.querySelector('.ss-settings-status');
