import assert from 'node:assert/strict';
import { inventoryScreen } from '../../../ui/legacy/screens/index.js';
import { createCoreModule } from '../../../modules/scene/domains/index.js';
import { createHarness } from './helpers/fake-ctx.js';
import { stocked } from './fixtures.js';
import { destroyTemplate } from '../../../ui/legacy/view/template/render.js';
import { show, settle } from '../../ui/screens/helpers.js';
import { page } from '../rpg/view/page.js';
import { reply } from '../../core/helpers/gear-ui-state.js';
import { createWornFoldWidget, WORN_FOLD_WIDGET } from '../../../ui/legacy/screens/inventory-add.js';

export const draw = (host, options = {}) => show(inventoryScreen, { state: host.head(), query: host.sdk.query, draft: { wornOpen: '1' }, command: (type, payload, opts) => host.sdk.command(type, payload, opts), ...options });   // (Worn opened: every piece has its row)
export const rowOf = (el, name) => el.querySelectorAll('li.item').find(item => item.querySelector('.name')?.textContent === name);
export const headings = el => el.querySelectorAll('h4.ss-section-label').map(node => node.textContent.trim().replace(/\s+/g, ' '));

export const gearCore = () => createCoreModule({ hooks: () => [], settings: () => ({}), extras: { gearOn: () => true, persona: () => 'Astra' } });

// A state with a swordsman in the party, a sword that fits a weapon slot and a boat left at the wharf.
export function crewState() {
    const module = gearCore();
    const state = stocked(module);
    const inv = state.domains.inventory;
    inv.defs['pack.fantasy/iron-sword'].slot = 'weapon';
    state.domains.party = { actors: { ac_ren00001: { id: 'ac_ren00001', name: 'Ren' } } };
    state.domains.scene.place = { name: 'Mill Road', kind: '', region: '' };
    state.domains.scene.mounts = { 'm:left': { name: 'Skiff', kind: 'boat', count: 1, pace: 30, condition: '', where: 'moored at Eel Wharf' } };
    return { module, state };
}

export const gearRun = h => (type, payload) => h.run(type, payload, { cause: 'ui', extra: { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' } });

// The form's Save through the mounted screen with a screen that holds like the real one: a command's `committed` redraw (here only counted in `redraws`) waits while a plan holds (`api.hold`) and runs once at its end. `leave` closes the screen (a chat switch, the panel closed) after the first command;
// `refuse` turns the equip down.
export function mounted(h, { leave = false, refuse = false } = {}) {
    const calls = [], redraws = { n: 0, at: [] }, notices = [];
    let holds = 0, owed = false, shown = null;
    const redraw = () => { redraws.n++; };
    const hold = () => { holds++; let done = false; return () => { if (done) return; done = true; if (!--holds && owed) { owed = false; redraw(); } }; };
    shown = show(inventoryScreen, { state: h.state, query: h.query, draft: { wornOpen: '1' }, extra: { api: { hold, notify: text => notices.push(text) } }, command: async (type, payload) => {
        redraws.at.push(redraws.n);
        calls.push(type);
        const done = refuse && type === 'item.equip' ? { ok: false, message: 'No room to carry it.' } : await gearRun(h)(type, payload);
        if (leave && calls.length === 1) destroyTemplate(shown.el);
        else if (holds) owed = true;
        else redraw();
        return done;
    } });
    return { ...shown, calls, redraws, notices, holding: () => holds };
}
export const rowsOf = (el, name) => el.querySelectorAll('li.item').filter(item => item.querySelector('.name')?.textContent === name);
export const open = (el, name) => { const row = rowOf(el, name); row.querySelector('.ss-w-editable-pencil').click(); return row; };

// Two swords of one owner; the second (it_sword009) is worse worn; the first may be worn by `wear`.
export function twoSwords(wear = null) {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.stacks.it_sword009 = { ...inv.stacks.it_sword001, id: 'it_sword009', cond: 40 };
    if (wear) Object.assign(inv.stacks.it_sword001, { equipped: wear });
    return { h: createHarness([module], { state }), inv };
}
export const pieces = inv => Object.values(inv.stacks).filter(item => item.def === 'pack.fantasy/iron-sword');

// The game view mounts the Inventory screen too: its body redraws from `committed` through the same hold as the panel's.
export async function gameForm(t, wrap = null) {
    t.mock.method(console, 'warn', () => {});
    // These tests edit the List rows: this device's saved view is List (Grid is the default).
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => (key === 'story-block.inventoryView' ? 'list' : null), setItem() {}, removeItem() {} } });
    t.after(() => { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; });
    const { doc, host, ui } = await page(t, { wrap });
    host.features.set('story-block.gear', true);
    await host.send('Hello.', 'The road.');
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | slot: weapon']));
    assert.equal(ui.mounts.screen.open('story-block/inventory'), true);
    await settle();
    const screen = () => doc.querySelector('.ss-gameview [data-ss-screen="story-block/inventory"]');
    const fresh = () => rowOf(screen(), 'Iron Sword');
    const row = fresh();
    row.querySelector('.ss-w-editable-pencil').click();
    return { host, row, fresh, screen };
}
export const fill = row => {
    row.querySelectorAll('input')[2].value = 'keen';
    row.querySelectorAll('select')[1].value = 'party';
    row.querySelector('.ss-w-editable-save').click();
};

export const BAG = ['+ item Skinner Billhook | rarity: uncommon | slot: weapon', '+ item Grey Hood | slot: head'];
export const names = list => list.map(item => item.querySelector('.name').textContent);
export const groupRows = (el, kind) => el.querySelector(`section.group[data-kind="${kind}"]`).querySelectorAll('li.item');
export const buttonsOf = (root, label) => root.querySelectorAll('button').filter(node => node.textContent.trim().replace(/\s+/g, ' ') === label);
export const memory = () => { const map = new Map(); return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
export const foldWidgets = storage => ({ [WORN_FOLD_WIDGET]: createWornFoldWidget({ chatKey: () => 'chat-1', storage }) });
