// Gear in fights, the screens (`story-block.gear`): the Inventory tab's Carry card and rows, gear.view,
// Settings card, and the bag list + folded Worn row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../testkit/index.js';
import { createCoreModule } from '../../src/v2/domains/index.js';
import { createHarness } from './domains/helpers/fake-ctx.js';
import { settle, text } from '../../../../tests/ui/screens/helpers.js';
import { page } from '../../../../tests/modules/rpg/view/page.js';
import { FIGHT, dump, gearHost } from '../../../../tests/core/helpers/gear-ui-state.js';
import { createWornFoldWidget, WORN_FOLD_WIDGET } from '../../../../ui/legacy/screens/inventory-add.js';
import { BAG, buttonsOf, crewState, draw, foldWidgets, groupRows, headings, memory, names, rowOf } from './gear-ui.helpers.js';

test('Inventory, gear on: Carry first, then Equipment (in the bag), the wearer\'s Worn list, Consumables, Goods; the Carry card is a row-style card with the load, a bar and the breakdown', async t => {
    const host = await gearHost(t);
    const { el, view, problems } = draw(host);
    assert.deepEqual([view.warnings, problems], [[], []]);
    assert.deepEqual(headings(el).filter(Boolean).slice(0, 5), ['Carry', 'Equipment \u00b7 in the bag', 'You', 'Consumables', 'Goods']);
    assert.ok(el.querySelector('.inv').classList.contains('gear'));
    const sections = el.querySelectorAll('section.group, section.carry-sec');
    assert.equal(sections[0].classList.contains('carry-sec'), true, 'Carry is the first section');
    const card = el.querySelector('.carry-sec li.item.ss-glass.carry-card');
    assert.ok(card, 'the card is an item row\'s card');
    assert.match(text(card.querySelector('.carry-line')), /^\d+ \/ 30$/);
    assert.equal(card.querySelectorAll('.ss-bar-track').length, 1);
    assert.match(text(card.querySelector('.carry-break')), /^Strength 30$/);
    assert.doesNotMatch(card.className, /heavy|over/, 'normal below 80 %');
    assert.equal(el.querySelector('.carry-sec').querySelector('.carry-state'), null);
    // "+ Add item" is the compact pill (about 30px drawn, a 44px tap area), one line, on a phone as on a desktop.
    const add = el.querySelector('.ss-w-inventory-add button');
    assert.deepEqual([add.textContent, add.classList.contains('ss-tap-pill')], ['+ Add item', true]);
});

test('the Carry card\'s colour bands: normal under 80 %, yellow Heavy load from 80 % to below 100 %, red Encumbered from 100 %', async t => {
    // Capacity 30 (10 + 2 × STR 10). The base state holds 8 items (Healing Salve counts 2).
    const at = async load => {
        const host = await gearHost(t, { wear: [], extra: [`+ item Brick | qty: ${load - 8}`] });
        const { el } = draw(host);
        const card = el.querySelector('.carry-card');
        return { numbers: text(card.querySelector('.carry-num')), classes: card.classes().filter(name => ['heavy', 'over'].includes(name)), state: card.querySelector('.carry-state') ? text(card.querySelector('.carry-state')) : '' };
    };
    assert.deepEqual(await at(23), { numbers: '23 / 30', classes: [], state: '' }, '77 %');
    assert.deepEqual(await at(24), { numbers: '24 / 30', classes: ['heavy'], state: 'Heavy load' }, '80 %');
    assert.deepEqual(await at(29), { numbers: '29 / 30', classes: ['heavy'], state: 'Heavy load' }, '97 %');
    assert.deepEqual(await at(30), { numbers: '30 / 30', classes: ['over'], state: 'Encumbered: AGI and DEX −2' }, '100 %: encumbered (at or over the limit)');
    assert.deepEqual(await at(31), { numbers: '31 / 30', classes: ['over'], state: 'Encumbered: AGI and DEX −2' }, 'over the limit');
});

test('Inventory rows, gear on: rarity colour and word, slot chip, Equipped · owner, stat bonus, condition bar and word; broken says no bonus', async t => {
    const host = await gearHost(t);
    const { el } = draw(host);
    const cane = rowOf(el, 'Cane Sword');
    assert.ok(cane.classList.contains('r-rare'), 'the rarity colour is on the row');
    assert.equal(text(cane.querySelector('.rarity')), 'rare');
    assert.equal(text(cane.querySelector('.chip.slot')), 'weapon');
    assert.equal(text(cane.querySelector('.chip.worn-by')), 'Equipped · You');
    assert.equal(text(cane.querySelector('.gear-line .bonus')), '+3 AGI');
    assert.equal(text(cane.querySelector('.cword')), 'Worn', 'one step down: worn');
    assert.ok(cane.querySelector('.cbar.w-worn'));
    const cap = rowOf(el, 'Iron Cap');
    assert.equal(text(cap.querySelector('.cword')), 'Good');
    assert.equal(cap.querySelector('.cbar').classList.contains('w-worn'), false);
    assert.equal(text(cap.querySelector('.gear-line .bonus')), '+2 VIT');
    const jerkin = rowOf(el, 'Boiled Leather Jerkin');
    assert.equal(text(jerkin.querySelector('.cword')), 'Torn', 'two steps: torn (the body armour takes the blow)');
    assert.ok(jerkin.querySelector('.cbar.w-torn'));
    const buckler = rowOf(el, 'Oak Buckler');
    assert.equal(text(buckler.querySelector('.cword')), 'Broken — no bonus', 'three steps: broken');
    assert.ok(buckler.querySelector('.cbar.w-broken') && buckler.classList.contains('broken'));
    assert.equal(text(buckler.querySelector('.gear-line .bonus')), '+2 VIT', 'what it would give is still shown; the word says it gives none');
    // Not worn: no Equipped chip; goods and consumables have no bar.
    const salve = rowOf(el, 'Healing Salve');
    assert.equal(salve.querySelector('.chip.worn-by'), null);
    assert.equal(salve.querySelector('.cbar'), null);
    // The worn pieces have Unequip; nothing here is in the bag, so no Equip.
    assert.equal(el.querySelectorAll('button').filter(node => text(node) === 'Unequip').length, 5);
    assert.equal(el.querySelectorAll('button').filter(node => text(node) === 'Equip').length, 0);
    // The filter box and "Equipped only" still work as before.
    assert.equal(el.querySelectorAll('.filter select').length, 2);
});

test('gear off: the Inventory screen renders exactly as it did before the feature existed', async t => {
    const host = await gearHost(t, { gear: false });
    const { el, view, problems } = draw(host);
    assert.deepEqual([view.warnings, problems], [[], []]);
    assert.equal(dump(el), readFileSync(new URL('../../../../tests/core/fixtures/inventory-gear-off.html', import.meta.url), 'utf8'));
    assert.equal(el.querySelector('.carry-sec'), null);
    assert.equal(el.querySelector('.ss-w-inventory-add button').classList.contains('ss-tap-pill'), false, 'the add button is the one it always was');
    assert.equal(el.querySelector('.inv').classList.contains('gear'), false);
    // The switch on with the RPG off is as off.
    const half = await createHost({ modules: [FIGHT], settings: { features: { 'story-block.gear': true } } });
    t.after(() => half.close());
    assert.equal(half.sdk.query('gear.view', {}), null);
});

test('gear.view: the persona is the main wearer, members follow; the breakdown, a mount left elsewhere, and a member\'s slots by name', () => {
    const { module, state } = crewState();
    state.domains.inventory.stacks.it_dagg0001.owner = 'ac_ren00001';
    state.domains.inventory.stacks.it_dagg0001.equipped = 'weapon';
    state.domains.inventory.defs['pack.fantasy/dagger'].slot = 'weapon';
    state.domains.inventory.defs['pack.fantasy/dagger'].rarity = 'rare';
    const h = createHarness([module], { state });
    const view = h.query('gear.view', {});
    assert.deepEqual(view.owners, [{ value: 'party', label: 'Astra' }, { value: 'ac_ren00001', label: 'Ren' }]);
    assert.equal(view.carry.breakdown, 'Strength 30');
    assert.deepEqual(view.carry.away, ['Skiff +100 \u00b7 moored at Eel Wharf, not with you']);
    assert.equal(view.rows.it_dagg0001.by, 'Ren');
    assert.equal(view.rows.it_sword001.by, '');
    const ren = h.query('gear.view', { who: 'Ren' });
    assert.deepEqual([ren.owner, ren.slots.weapon.name, ren.slots.weapon.bonus, ren.slots.head], ['ac_ren00001', 'Dagger', '+3 DEX', null]);
    const own = h.query('gear.view', { who: 'Whoever', own: true });
    assert.equal(own.owner, 'party', 'the reader\'s own card is the party\'s bag');
    assert.deepEqual(Object.values(h.query('gear.view', { who: 'Nobody' }).slots).filter(Boolean), [], 'an unknown name wears nothing');
    assert.equal(createHarness([createCoreModule({ hooks: () => [], settings: () => ({}) })], { state }).query('gear.view', {}), null, 'off: nothing');
});

test('Settings, RPG: the Gear in fights card sits after the Stat formula, with On and Off buttons like Rolls, and its words', async t => {
    const ctx = await page(t, { feature: true });
    const win = ctx.ui.openSettings();
    win.select('rpg');
    await settle();
    const root = ctx.doc.querySelector('[data-ss-section="rpg"]');
    assert.deepEqual(root.querySelectorAll('.rpg-set-title').slice(0, 4).map(node => node.textContent), ['Stat formula', 'Levels and practice', 'Gear in fights', 'Rolls']);
    const card = root.querySelector('[data-card="gear"]');
    assert.deepEqual(card.querySelectorAll('.rpg-chip').map(node => node.textContent), ['On', 'Off']);
    assert.equal(card.querySelector('[aria-pressed="true"]').textContent, 'Off', 'off until the reader switches it on');
    assert.match(card.textContent, /^Gear in fightsOnOffOn: worn gear adds stat points by rarity \(common \+0 up to legendary \+4\); .* Off: fights run as before; items, rarity and slots are kept\.$/);
    assert.deepEqual(root.querySelector('[data-card="rolls"]').querySelectorAll('.rpg-chip').map(node => node.textContent), ['Automatic', 'Off'], 'Rolls keeps its own choices');
    assert.equal(root.querySelector('[data-card="checks"] [role="switch"]').getAttribute('aria-checked'), 'true', 'Story checks has its own default-on switch');
});

test('Inventory, gear on: Equipment lists only the pieces nobody wears, each keeping its bonus, condition and rarity colour, with Equip; Carry still counts everything', async t => {
    const host = await gearHost(t, { extra: BAG });
    const folded = draw(host, { draft: {}, widgets: foldWidgets(memory()) });
    const rows = groupRows(folded.el, 'equipment');
    assert.deepEqual(names(rows), ['Grey Hood', 'Skinner Billhook'], 'the five worn pieces are not listed here');
    const billhook = rowOf(folded.el, 'Skinner Billhook');
    assert.ok(billhook.classList.contains('r-uncommon'));
    assert.equal(text(billhook.querySelector('.gear-line .bonus')), '+2 STR');
    assert.equal(text(billhook.querySelector('.cword')), 'Good');
    assert.ok(billhook.querySelector('.cbar'));
    assert.deepEqual(rows.map(row => buttonsOf(row, 'Equip').length), [1, 1]);
    assert.equal(buttonsOf(folded.el, 'Unequip').length, 0, 'the worn rows are folded away');
    assert.equal(headings(folded.el)[1], 'Equipment \u00b7 in the bag');
    // The load counts every piece owned, worn or not.
    const opened = draw(host);
    assert.equal(text(folded.el.querySelector('.carry-num')), text(opened.el.querySelector('.carry-num')));
    // Equip: choose the wearer; the taken weapon slot swaps and the Cane Sword goes back to the bag.
    buttonsOf(billhook, 'Equip')[0].click();
    const who = buttonsOf(billhook.querySelector('.fold.use-on'), 'You');
    assert.equal(who.length, 1);
    who[0].click();
    await settle();
    const stacks = Object.values(host.head().domains.inventory.stacks);
    const sword = stacks.find(stack => stack.def.endsWith('cane-sword') || /cane/i.test(stack.def));
    const hook = stacks.find(stack => /billhook/i.test(stack.def));
    assert.equal(hook.equipped, 'weapon');
    assert.equal(sword?.equipped ?? null, null, 'the old piece is back in the bag');
    assert.deepEqual(names(groupRows(draw(host, { draft: {}, widgets: foldWidgets(memory()) }).el, 'equipment')).sort(), ['Cane Sword', 'Grey Hood']);
});

test('Inventory, gear on: the Worn (N) row is folded by default with "wearer count"; opened it groups the worn pieces by wearer with Unequip; the choice is kept per chat on this device', async t => {
    const host = await gearHost(t, { extra: BAG });
    const store = memory();
    const first = draw(host, { draft: {}, widgets: foldWidgets(store) });
    const fold = first.el.querySelector('.worn-fold-btn');
    assert.equal(text(fold), 'Worn (5)You 5');
    assert.equal(fold.getAttribute('aria-expanded'), 'false');
    assert.ok(fold.querySelector('svg path'), 'a drawn chevron, as the Party card\'s Left row');
    assert.equal(first.el.querySelectorAll('.worn-who').length >= 0 && first.el.querySelectorAll('.worn-who li.item').length, 0);
    fold.click();
    await settle();
    assert.equal(first.el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'true');
    assert.equal(text(first.el.querySelector('.worn-fold-btn')), 'Worn (5)', 'opened: no wearer summary');
    const groups = first.el.querySelectorAll('.worn-who');
    assert.deepEqual(groups.map(group => text(group.querySelector('h4'))), ['You']);
    const worn = groups[0].querySelectorAll('li.item');
    assert.deepEqual(names(worn).sort(), ['Boiled Leather Jerkin', 'Cane Sword', 'Iron Cap', 'Moss-Agate Ring', 'Oak Buckler']);
    assert.equal(text(rowOf(first.el, 'Cane Sword').querySelector('.gear-line .bonus')), '+3 AGI');
    assert.ok(rowOf(first.el, 'Cane Sword').classList.contains('r-rare'));
    assert.equal(buttonsOf(rowOf(first.el, 'Cane Sword'), 'Unequip').length, 1);
    assert.ok(rowOf(first.el, 'Cane Sword').querySelector('.ss-w-editable-pencil'), 'Edit stays on a worn row');
    assert.deepEqual([...store.map], [['story-block.inventoryWornOpen|chat-1', '1']]);
    // The same chat on this device opens it again; another chat does not.
    const again = draw(host, { draft: {}, widgets: foldWidgets(store) });
    await settle();
    assert.equal(again.el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'true');
    const other = draw(host, { draft: {}, widgets: { [WORN_FOLD_WIDGET]: createWornFoldWidget({ chatKey: () => 'chat-2', storage: store }) } });
    await settle();
    assert.equal(other.el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'false');
    // Unequip sends inventory.unequip: the piece goes to the bag list.
    buttonsOf(rowOf(first.el, 'Iron Cap'), 'Unequip')[0].click();
    await settle();
    assert.deepEqual(first.calls.map(([type]) => type), ['inventory.unequip']);
    const cap = Object.values(host.head().domains.inventory.stacks).find(stack => /cap/i.test(stack.def));
    assert.equal(cap.equipped ?? null, null);
    // Closing keeps the choice too.
    first.el.querySelector('.worn-fold-btn').click();
    await settle();
    assert.equal(store.map.size, 0);
    assert.equal(first.el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'false');
    assert.match(text(draw(host, { draft: {}, widgets: foldWidgets(memory()) }).el.querySelector('.worn-fold-btn')), /^Worn \(4\)You 4$/, 'drawn again: four are still worn');
});

test('Worn row: a storage that throws means folded, and the choice then lasts this page', async t => {
    const host = await gearHost(t);
    const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
    const { el } = draw(host, { draft: {}, widgets: foldWidgets(broken) });
    await settle();
    assert.equal(el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'false');
    el.querySelector('.worn-fold-btn').click();
    await settle();
    assert.equal(el.querySelector('.worn-fold-btn').getAttribute('aria-expanded'), 'true');
});
