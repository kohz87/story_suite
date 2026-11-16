// Gear in fights, the screens (`story-block.gear`): item Edit's Slot and Equipped by,
// multi-step Save plans, holds/redraws, refusals, and game-view Edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { inventoryScreen } from '../../../../ui/legacy/screens/index.js';
import { createHarness } from './domains/helpers/fake-ctx.js';
import { show, settle, text } from '../../../../tests/ui/screens/helpers.js';
import { editPlan } from '../../../../ui/legacy/view/gear-form.js';
import { FIGHT, gearHost } from '../../../../tests/core/helpers/gear-ui-state.js';
import { createScreenRenderer } from '../../../../ui/legacy/view/render-screen.js';
import { resolveData } from '../../../../ui/legacy/view/screens.js';
import { standardWidgets } from '../../../../ui/legacy/view/widgets/index.js';
import { installFakeDom } from '../../../../tests/helpers/ui-fake-dom.js';
import { createInventoryAddWidget, createInventoryViewWidget, createWornFoldWidget, WORN_FOLD_WIDGET, INVENTORY_ADD_WIDGET, INVENTORY_VIEW_WIDGET } from '../../../../ui/legacy/screens/inventory-add.js';
import { crewState, draw, fill, gameForm, gearRun, mounted, open, pieces, rowOf, rowsOf, twoSwords } from './gear-ui.helpers.js';

test('Edit, gear on: Slot (the eight places or none) and Equipped by (a member or none) go through item.equip; transfer and unequip too; a rebuild and a reload agree', async t => {
    const host = await gearHost(t, { wear: [] });
    const first = draw(host);
    const cane = rowOf(first.el, 'Cane Sword');
    cane.querySelector('.ss-w-editable-pencil').click();
    const selects = cane.querySelectorAll('select');
    assert.deepEqual(selects.map(node => node.getAttribute('aria-label')), ['Slot', 'Equipped by', 'Stat 1', 'Stat 2']);
    assert.deepEqual(selects[0].querySelectorAll('option').map(node => node.textContent), ['None', 'Head', 'Body', 'Cloak', 'Feet', 'Weapon', 'Off-hand', 'Accessory 1', 'Accessory 2']);
    assert.deepEqual(selects[1].querySelectorAll('option').map(node => node.textContent), ['None', 'You']);
    assert.deepEqual([selects[0].value, selects[1].value], ['weapon', 'party'], 'the form opens on what is true now');
    // A piece that is not worn opens on its own slot and nobody.
    const salve = rowOf(first.el, 'Healing Salve');
    salve.querySelector('.ss-w-editable-pencil').click();
    assert.equal(salve.querySelectorAll('select').length, 0, 'not equipment: no Slot and no Equipped by');
    // Take the sword off (Equipped by: none).
    selects[1].value = '';
    cane.querySelector('.ss-w-editable-save').click();
    await settle();
    const swordRow = () => host.sdk.query('inventory.items').find(item => item.name === 'Cane Sword');
    assert.equal(swordRow().equipped, null);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus.AGI, 0);
    // Put it on again, through item.equip.
    const second = draw(host);
    const again = rowOf(second.el, 'Cane Sword');
    again.querySelector('.ss-w-editable-pencil').click();
    const boxes = again.querySelectorAll('select');
    assert.deepEqual([boxes[0].value, boxes[1].value], ['weapon', ''], 'its own slot, nobody');
    boxes[1].value = 'party';
    again.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual([swordRow().equipped, swordRow().equippedBy], ['weapon', 'party']);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus.AGI, 3);
    const calls = second.calls.map(([type, payload]) => [type, payload.slot ?? null]);
    assert.deepEqual(calls, [['item.equip', 'weapon']]);
    assert.deepEqual(first.calls.map(([type]) => type), ['inventory.unequip']);
    // A refusal shows its sentence and leaves the form open: a sword does not fit the head.
    const third = draw(host);
    const odd = rowOf(third.el, 'Cane Sword');
    odd.querySelector('.ss-w-editable-pencil').click();
    const choose = odd.querySelectorAll('select');
    choose[0].value = 'head';
    odd.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.match(text(odd.querySelector('.ss-w-editable-error')), /does not fit the head slot/);
    assert.equal(swordRow().equipped, 'weapon');
    // Replay: a rebuild and a reload give the same.
    const stable = inv => JSON.stringify({ ...inv, stacks: Object.fromEntries(Object.entries(inv.stacks).map(([id, item]) => [id, { ...item, from: undefined }])) });
    const live = stable(host.head().domains.inventory);
    host.store.rebuild();
    assert.equal(stable(host.head().domains.inventory), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [FIGHT], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.equal(stable(loaded.head().domains.inventory), live, 'a reload equals live');
});

test('Edit, gear on: Equipped by a member hands the piece over and puts it on in one command (item.equip with transfer)', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const calls = [];
    const { el } = show(inventoryScreen, {
        state: h.state, query: h.query,
        command: (type, payload) => { calls.push([type, payload]); return h.run(type, payload, { cause: 'ui', extra: { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' } }); },
    });
    const sword = rowOf(el, 'Iron Sword');
    sword.querySelector('.ss-w-editable-pencil').click();
    const [slot, by] = sword.querySelectorAll('select');
    assert.deepEqual([slot.value, by.value], ['weapon', ''], 'its own slot, nobody');
    assert.deepEqual(by.querySelectorAll('option').map(node => node.textContent), ['None', 'Astra', 'Ren']);
    by.value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls.map(([type]) => type), ['item.equip'], 'one command: all or nothing (G7)');
    const held = Object.values(h.state.domains.inventory.stacks).find(item => item.def === 'pack.fantasy/iron-sword');
    assert.deepEqual([held.owner, held.equipped], ['ac_ren00001', 'weapon']);
});

test('Edit, gear on: a note change and a wearer in one Save finish both steps with no redraw in between and one after', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const { el, calls, redraws } = mounted(h);
    const sword = open(el, 'Iron Sword');
    const [, , note] = sword.querySelectorAll('input');
    note.value = 'keen';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.deepEqual(calls, ['inventory.edit', 'item.equip']);
    assert.deepEqual(redraws.at, [0, 0], 'the second step began before any redraw');
    assert.equal(redraws.n, 1, 'one redraw once the plan ended');
    const held = h.state.domains.inventory.stacks.it_sword001;
    assert.deepEqual([held.note, held.owner, held.equipped], ['keen', 'ac_ren00001', 'weapon']);
});

test('Edit, gear on: reducing a group\'s count while choosing a wearer keeps the selected (second) piece and its condition', async () => {
    const { h } = twoSwords();
    const { el, calls } = mounted(h);
    const sword = rowsOf(el, 'Iron Sword')[1];
    sword.querySelector('.ss-w-editable-pencil').click();
    const [, count] = sword.querySelectorAll('input');
    count.value = '1';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls, ['inventory.edit', 'item.equip']);
    const left = pieces(h.state.domains.inventory);
    assert.deepEqual(left.map(item => [item.id, item.cond, item.owner, item.equipped]), [['it_sword009', 40, 'ac_ren00001', 'weapon']]);
});

test('Edit, gear on: a count that would remove the selected piece (the other is worn) is refused, nothing changes', async () => {
    const { h } = twoSwords('weapon');
    const { el, calls } = mounted(h);
    const sword = rowsOf(el, 'Iron Sword')[0];   // (the one in the bag is listed first; the worn one is under Worn)
    sword.querySelector('.ss-w-editable-pencil').click();
    const [, count] = sword.querySelectorAll('input');
    count.value = '1';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls, ['inventory.edit']);
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /remove the piece you are editing/);
    assert.deepEqual(pieces(h.state.domains.inventory).map(item => [item.id, item.cond, item.owner]), [['it_sword001', undefined, 'party'], ['it_sword009', 40, 'party']]);
});

test('Edit, gear on: an unchanged Save keeps a piece worn by a member who left', async () => {
    const { module, state } = crewState();
    const worn = state.domains.inventory.stacks.it_sword001;
    worn.owner = 'ac_gone0001';
    worn.equipped = 'weapon';
    const h = createHarness([module], { state });
    const { el, calls } = mounted(h);
    const sword = open(el, 'Iron Sword');
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls, [], 'no unequip');
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /^Nothing to change/);
    assert.deepEqual([worn.owner, worn.equipped].join(), 'ac_gone0001,weapon');
});

test('Edit, gear on: Save with nothing to change says so in the form instead of closing', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const calls = [];
    const { el } = show(inventoryScreen, { state: h.state, query: h.query, command: (type, payload) => { calls.push(type); return gearRun(h)(type, payload); } });
    const sword = rowOf(el, 'Iron Sword');
    sword.querySelector('.ss-w-editable-pencil').click();
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls, []);
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /^Nothing to change: no one wears it\.$/);
    const [slot] = sword.querySelectorAll('select');
    slot.value = 'weapon';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /Nothing to change/, 'a Slot with nobody to wear it changes nothing');
});

test('Edit, gear on: choosing None for a piece a member who left wears takes it off; leaving the choice alone does not', async () => {
    const { module, state } = crewState();
    const worn = state.domains.inventory.stacks.it_sword001;
    Object.assign(worn, { owner: 'ac_gone0001', equipped: 'weapon' });
    const h = createHarness([module], { state });
    const { el, calls } = mounted(h);
    const sword = open(el, 'Iron Sword');
    const by = sword.querySelectorAll('select')[1];
    assert.deepEqual([by.value, by.querySelectorAll('option').map(node => node.textContent)], ['ac_gone0001', ['None', 'Astra', 'Ren', 'Left the party']]);
    by.value = '';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    assert.deepEqual(calls, ['inventory.unequip']);
    assert.equal(h.state.domains.inventory.stacks.it_sword001.equipped, null);
});

test('Edit, gear on: closing the screen mid-plan stops the next step', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const { el, calls } = mounted(h, { leave: true });
    const sword = open(el, 'Iron Sword');
    sword.querySelectorAll('input')[2].value = 'keen';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.deepEqual(calls, ['inventory.edit'], 'the equip never ran');
    assert.equal(h.state.domains.inventory.stacks.it_sword001.equipped, null);
});

test('Edit, gear on: a refusal in the second step releases the hold, redraws once and shows as a notice', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const { el, calls, redraws, notices, holding } = mounted(h, { refuse: true });
    const sword = open(el, 'Iron Sword');
    sword.querySelectorAll('input')[2].value = 'keen';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.deepEqual(calls, ['inventory.edit', 'item.equip']);
    assert.deepEqual(redraws.at, [0, 0]);
    assert.equal(holding(), 0, 'the hold is released after the refusal');
    assert.equal(redraws.n, 1, 'the screen redraws once');
    assert.deepEqual(notices, ['No room to carry it.'], 'the late refusal shows as a page notice');
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /No room to carry it/);
    assert.equal(h.state.domains.inventory.stacks.it_sword001.note, 'keen');
});

test('Edit, gear on: renaming a piece and changing its carry on a definition two pieces share changes only the selected piece', () => {
    const { module, state } = crewState();
    const inv = state.domains.inventory;
    inv.defs['story/bag'] = { ...structuredClone(inv.defs['pack.fantasy/iron-sword']), id: 'story/bag', name: 'Bag', carry: 5, slot: 'accessory1' };
    for (const id of ['it_bag00001', 'it_bag00002']) inv.stacks[id] = { ...inv.stacks.it_sword001, id, def: 'story/bag', equipped: null };
    const h = createHarness([module], { state });
    const plan = editPlan({ value: 'Bag', itemCount: 1, gear: { stack: 'it_bag00002', kind: 'equipment', place: '', by: '', owner: inv.stacks.it_bag00002.owner, row: { hand: true, defSlot: 'accessory1', carry: 5, stats: {} } } });
    const { steps, error } = plan({ name: 'Satchel', carry: 10 }, { name: 'Satchel', count: 1, note: '', kind: 'equipment', slot: 'accessory1', rarity: 'common', by: '', carry: 10 });
    assert.equal(error, undefined);
    assert.deepEqual(steps.map(step => step.command), ['inventory.edit', 'inventory.carry'], 'the rename first, then the carry');
    for (const step of steps) assert.equal(gearRun(h)(step.command, step.payload).ok, true, step.command);
    const after = h.state.domains.inventory;
    assert.deepEqual([after.defs[after.stacks.it_bag00002.def].name, after.defs[after.stacks.it_bag00002.def].carry], ['Satchel', 10]);
    assert.deepEqual([after.defs[after.stacks.it_bag00001.def].name, after.defs[after.stacks.it_bag00001.def].carry], ['Bag', 5], 'the other piece is untouched');
});

test('Edit in the game view, gear on: a note and a wearer in one Save run both steps and the screen redraws once after', async t => {
    const seen = [];
    let form;
    form = await gameForm(t, (type, payload, options, run) => { seen.push([type, form.row.isConnected]); return run(type, payload, options); });
    fill(form.row);
    await settle();
    assert.deepEqual(seen, [['inventory.edit', true], ['item.equip', true]], 'the form was alive for both steps');
    assert.equal(form.row.isConnected, false, 'the screen redrew after the plan');
    const held = Object.values(form.host.head().domains.inventory.stacks).find(item => item.note === 'keen');
    assert.deepEqual([held.owner, held.equipped], ['party', 'weapon']);
    assert.match(text(form.screen()), /Worn \(1\)/, 'the piece is worn now: the folded Worn row counts it');
});

test('Edit in the game view, gear on: a refusal in the second step redraws the screen and later commands redraw at once', async t => {
    const form = await gameForm(t, (type, payload, options, run) => (type === 'item.equip' ? { ok: false, message: 'No room to carry it.' } : run(type, payload, options)));
    fill(form.row);
    await settle();
    assert.equal(form.row.isConnected, false, 'the hold went with the plan: the screen redrew');
    assert.match(text(form.fresh()), /keen/);
    const later = form.fresh();
    form.host.events.emit('committed', {});
    assert.equal(later.isConnected, false, 'no hold is left behind: the next redraw runs at once');
});

test('Edit, gear on: a refusal in the first step keeps the form with its sentence and no notice, and holds nothing', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const { el, notices, holding } = mounted(h, { refuse: true });
    const sword = open(el, 'Iron Sword');
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /No room to carry it/);
    assert.deepEqual([holding(), notices.length], [0, 0]);
    assert.equal(sword.isConnected, true);
});

test('Edit, gear on: destroying the form mid-plan releases the hold', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const { el, holding } = mounted(h, { leave: true });
    const sword = open(el, 'Iron Sword');
    sword.querySelectorAll('input')[2].value = 'keen';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.equal(holding(), 0);
});

// The late refusal of a multi-step item form, through the real renderer the mounts use (render-screen.js), not a scope the test builds: its widget api carries the page's `notify`.
test('Edit, gear on: a refusal after a committed step reaches the page notice through the real screen renderer', async () => {
    const { module, state } = crewState();
    const h = createHarness([module], { state });
    const doc = installFakeDom();
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    doc.head ??= doc.createElement('head');
    const notices = [];
    const renderer = createScreenRenderer({ queryAt: (name, args, at) => h.query(name, args), widgets: () => ({ ...standardWidgets, [INVENTORY_ADD_WIDGET]: createInventoryAddWidget(), [WORN_FOLD_WIDGET]: createWornFoldWidget({ storage: null }), [INVENTORY_VIEW_WIDGET]: createInventoryViewWidget({ storage: null, fallback: 'list' }) }) });
    const api = { hold: () => () => {}, notify: text => notices.push(text), on: () => () => {},
        command: async (type, payload) => (type === 'item.equip' ? { ok: false, message: 'No room to carry it.' } : gearRun(h)(type, payload)) };
    const data = resolveData(inventoryScreen.data, h.query);
    renderer.render(el, inventoryScreen, { state: h.state, q: data.q, api, mount: 'tab', draft: { wornOpen: '1' }, changes: [], settings: {} });
    const sword = open(el, 'Iron Sword');
    sword.querySelectorAll('input')[2].value = 'keen';
    sword.querySelectorAll('select')[1].value = 'ac_ren00001';
    sword.querySelector('.ss-w-editable-save').click();
    await settle();
    await settle();
    assert.deepEqual(notices, ['No room to carry it.']);
    assert.match(text(sword.querySelector('.ss-w-editable-error')), /No room to carry it/);
});
