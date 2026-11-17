// Gear in fights, inventory side (`story-block.gear`, off by default; docs/v2/GEAR.md): replay, condition words/value, mounts & carts, settings switch, equipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITION, KIND_CARRY, carryPicture, condMark, condWord, gearBudget, itemCarryOf, kindCarry, statsFor, travelsWith, valueByCond } from '../../../modules/inventory/gear.js';
import { validateInventory } from '../../../modules/inventory/index.js';
import { createHost } from '../../../testkit/index.js';
import { page, settle } from '../rpg/view/page.js';
import { createHarness, line } from './helpers/fake-ctx.js';
import { core, stocked } from './fixtures.js';
import { FIGHT, OFF, ON, defNamed, equip, fresh, gearCore, reply, tail, wear } from './gear-inventory.helpers.js';

test('replay equals live after a swipe, a Re-read, a delete, a rebuild and a reload', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare', '+ item Stone | qty: 10']));
    await equip(host, 'Iron Sword');
    await host.send('Fight.', reply('A blow.', ['~ hit weapon 1']));
    await host.send('Haul.', reply('A load.', ['+ item Brick | qty: 25']));
    const stable = inv => ({ ...inv, stacks: Object.fromEntries(Object.entries(inv.stacks).map(([id, item]) => [id, { ...item, from: undefined }])) });
    const view = () => JSON.stringify([stable(host.head().domains.inventory), host.sdk.query('inventory.gear', { owner: 'party' }), host.sdk.query('inventory.encumbrance')]);
    const live = view();
    assert.equal(host.sdk.query('inventory.encumbrance').encumbered, true);
    host.store.rebuild();
    assert.equal(view(), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [FIGHT], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.equal(JSON.stringify([stable(loaded.head().domains.inventory), loaded.sdk.query('inventory.gear', { owner: 'party' })]), JSON.stringify([stable(host.head().domains.inventory), host.sdk.query('inventory.gear', { owner: 'party' })]), 'a reload equals live');
    // A Re-read of the head reply as it stands changes nothing.
    const at = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(view(), live, 'a Re-read equals live');
    // A swipe takes the heavy load away (and with it the encumbrance); the wear of the earlier reply stays.
    await host.swipe(reply('Nothing after all.', ['+ coin 1']));
    assert.equal(host.sdk.query('inventory.encumbrance').encumbered, false);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.cond, 69);
    // Deleting the fight's reply takes its wear back; a rebuild agrees.
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => /A blow/.test(message.mes)));
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.cond, 100);
    assert.deepEqual(host.store.problems(), []);
    const after = view();
    host.store.rebuild();
    assert.equal(view(), after, 'a rebuild equals live after the delete');
});

test('a def renamed from a pack item loses the pack\'s bonus; the story-made copy takes the rarity\'s', () => {
    const module = core();
    const state = stocked(module);
    state.domains.inventory.defs['pack.fantasy/dagger'].bonus = 5;
    state.domains.inventory.defs['pack.fantasy/dagger'].rarity = 'rare';
    const h = createHarness([module], { state });
    assert.equal(gearBudget(state.domains.inventory.defs['pack.fantasy/dagger']), 5);
    assert.equal(h.run('inventory.edit', { stack: 'it_dagg0001', name: 'Rusty Knife' }).ok, true);
    const copy = Object.values(h.state.domains.inventory.defs).find(item => item.name === 'Rusty Knife');
    assert.deepEqual([copy.id.startsWith('story/'), copy.bonus, gearBudget(copy)], [true, undefined, 3]);
    assert.deepEqual(statsFor(state.domains.inventory.defs['pack.fantasy/dagger']), { DEX: 5 }, 'a pack item\'s budget of 5 on the dagger\'s stat');
});

test('condition words: Good is unmarked, Worn, Torn and Broken show after the name in the Equipped line and the Carried list (gear on only)', async t => {
    assert.deepEqual([100, 70, 69, 40, 39, 1, 0].map(condWord), ['good', 'good', 'worn', 'worn', 'torn', 'torn', 'broken']);
    assert.deepEqual([100, 50, 10, 0].map(condMark), ['', 'worn', 'torn', 'broken']);
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Cane Sword | rarity: fine', '+ item Oak Buckler', '+ item Spare Axe']));
    await equip(host, 'Cane Sword');
    await equip(host, 'Oak Buckler');
    await host.send('Go.', reply('On.', ['+ coin 1']));
    assert.match(tail(host), /^Equipped: Cane Sword \[weapon\], Oak Buckler \[off-hand\]$/m, 'Good: unmarked');
    await host.send('Hit.', reply('Blow.', ['~ hit weapon 1']));
    await host.send('Go.', reply('On.', ['+ coin 1']));
    assert.match(tail(host), /^Equipped: Cane Sword \(worn\) \[weapon\], Oak Buckler \[off-hand\]$/m);
    await host.send('Hit.', reply('Blow.', ['~ hit weapon 1', '~ hit off-hand 2']));
    await host.send('Go.', reply('On.', ['+ coin 1']));
    assert.match(tail(host), /^Equipped: Cane Sword \(torn\) \[weapon\], Oak Buckler \(torn\) \[off-hand\]$/m);
    await host.send('Hit.', reply('Blow.', ['~ hit weapon 1']));
    await host.send('Go.', reply('On.', ['+ coin 1']));
    assert.match(tail(host), /Cane Sword \(broken\) \[weapon\]/);
    // A carried piece shows it too (the pieces in the pack are worn out of the way first).
    await host.sdk.command('inventory.unequip', { stack: wear(host, 'Cane Sword').stack });
    await host.send('Go.', reply('On.', ['+ coin 1']));
    assert.match(tail(host), /^Carried: Cane Sword \(broken\), Spare Axe$/m);
    // Off: the same wear leaves the words out and the lines as they were.
    const off = await fresh(t, { gear: false, modules: [] });
    await off.send('Loot.', reply('Gear.', ['+ item Cane Sword']));
    await off.sdk.command('inventory.equip', { stack: wear(off, 'Cane Sword').stack, slot: 'weapon' });
    await off.sdk.command('inventory.wear', { stack: wear(off, 'Cane Sword').stack, amount: 100 }).catch(() => null);
    await off.send('Go.', reply('On.', ['+ coin 1']));
    assert.doesNotMatch(tail(off), /\((?:worn|torn|broken)\)/);
});

test('value by condition: Good 100%, Worn 75%, Torn 50%, Broken 20% on the price inventory.items gives, with gear on only', () => {
    assert.deepEqual(CONDITION.good.factor, 1);
    assert.deepEqual([100, 60, 20, 0].map(cond => valueByCond(50, cond)), [50, 38, 25, 10]);
    const module = gearCore();
    const state = stocked(module);
    const h = createHarness([module], { state });
    const price = () => h.query('inventory.items', {}).find(item => item.stack === 'it_sword001');
    assert.deepEqual([price().value, price().baseValue], [50, 50]);
    h.run('inventory.wear', { stack: 'it_sword001', amount: 40 }, { caller: 'zz', cause: 'story' });
    assert.deepEqual([price().value, price().baseValue], [38, 50], 'Worn');
    h.run('inventory.wear', { stack: 'it_sword001', amount: 30 }, { caller: 'zz', cause: 'story' });
    assert.equal(price().value, 25, 'Torn');
    h.run('inventory.wear', { stack: 'it_sword001', amount: 30 }, { caller: 'zz', cause: 'story' });
    assert.equal(price().value, 10, 'Broken');
    assert.equal(h.query('inventory.find', { name: 'Iron Sword' }).stacks[0].value, 10, 'inventory.find reads the same');
    // Off: the def\'s own value, no extra field.
    const plain = createHarness([core()], { state: h.state });
    const row = plain.query('inventory.items', {}).find(item => item.stack === 'it_sword001');
    assert.deepEqual([row.value, Object.hasOwn(row, 'baseValue')], [50, false]);
});

test('mounts and carts add their carry while they travel with the party', () => {
    assert.deepEqual(['horse', 'Pony', 'mule', 'donkey', 'pack animal', 'cart', 'barrow', 'hand-cart', 'Hand Cart', 'wagon', 'boat', 'ox', ''].map(kindCarry), [40, 30, 50, 50, 50, 60, 60, 60, 60, 150, 100, 20, 20]);
    assert.deepEqual(KIND_CARRY, { pony: 30, horse: 40, mule: 50, donkey: 50, cart: 60, barrow: 60, sledge: 60, carriage: 80, coach: 80, boat: 100, barge: 150, wagon: 150 });
    assert.equal(travelsWith('', 'Stray Oar'), true);
    assert.equal(travelsWith('ridden by Wessel', 'Stray Oar'), true);
    assert.equal(travelsWith('at the Stray Oar', 'Stray Oar'), true);
    assert.equal(travelsWith('stabled at the Stray Oar', 'Mill Road'), false);
    const module = gearCore();
    const state = stocked(module);
    state.domains.scene.place = { name: 'Mill Road', kind: '', region: '' };
    const mount = (name, kind, extra = {}) => ({ name, kind, count: 1, pace: 30, condition: '', where: '', ...extra });
    state.domains.scene.mounts = {
        'm:grey': mount('Grey', 'horse'), 'm:burr': mount('Burr', 'mule', { count: 2 }), 'm:cart': mount('Old Cart', 'cart', { carry: 90 }),
        'm:left': mount('Skiff', 'boat', { where: 'moored at Eel Wharf' }),
    };
    const h = createHarness([module], { state });
    const gear = () => h.query('inventory.gear', { owner: 'party' }).carry;
    // The reader (30) + Grey 20 + Burr 2 × 40 + the cart's own 90; the boat was left elsewhere.
    assert.equal(h.query('gear.carry', {}).capacity, 30 + 30 + 40 + 100 + 90, 'Ren\'s 30 is a person of their own');
    assert.deepEqual(gear().sources, [{ name: 'The reader', carry: 30 }, { name: 'Grey', carry: 40 }, { name: 'Burr', carry: 100 }, { name: 'Old Cart', carry: 90 }]);
    assert.equal(gear().capacity, 30 + 40 + 100 + 90);
    state.domains.scene.mounts['m:left'].where = '';
    h.state = state;
    assert.equal(gear().capacity, 30 + 40 + 100 + 90 + 100, 'the boat joined the party');
    // Without the Mounts rows nothing is added.
    delete state.domains.scene.mounts;
    h.state = state;
    assert.equal(gear().capacity, 30);
    // Off: nothing answers.
    assert.equal(createHarness([core()], { state }).query('gear.carry', {}), null);
});

test('a mount row\'s own carry is the reader\'s pencil: 1…1000, empty clears it', async t => {
    const host = await fresh(t);
    await host.send('Saddle.', reply('Yard.', ['+ mount Grey | kind: horse']));
    const row = () => host.sdk.query('mounts.list')[0];
    const edit = carry => host.sdk.command('mounts.edit', { mount: 'Grey', carry });
    assert.equal(row().carry, undefined);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).carry.capacity, 70, 'the reader 30 + a horse 40');
    assert.equal((await edit('45')).ok, true);
    assert.equal(row().carry, 45);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).carry.capacity, 75);
    assert.equal((await edit('1001')).ok, false);
    assert.equal((await edit('x')).ok, false);
    assert.equal((await edit('')).ok, true);
    assert.equal(row().carry, undefined, 'cleared: the kind\'s usual again');
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).carry.capacity, 70);
    host.store.rebuild();
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).carry.capacity, 70);
});

test('a cart, barrow, wagon, sledge, carriage, coach or barge the story names (a rented hand-cart) adds its kind\'s carry while owned, with gear on only', () => {
    assert.deepEqual(['Hand Cart', 'Rented hand-cart', 'Ox Wagon', 'Wheelbarrow', 'Sledge', 'Cartographer\'s Map', 'Rope'].map(itemCarryOf), [60, 60, 150, 60, 60, null, null]);
    const h = createHarness([gearCore()]);
    assert.equal(h.capture(line('+', 'item', 'Rented Hand Cart', {}), ON).ok, true);
    const cart = Object.values(h.state.domains.inventory.defs).find(item => item.name === 'Rented Hand Cart');
    assert.equal(cart.carry, 60);
    assert.deepEqual(validateInventory(h.state.domains.inventory), []);
    assert.equal(h.query('gear.carry', {}).capacity, 30 + 60);
    assert.deepEqual(h.query('gear.carry', {}).bonuses.map(entry => entry.carry), [60]);
    assert.equal(h.query('inventory.items', {})[0].carry, 60, 'the Inventory shows its +60');
    assert.equal(h.capture(line('+', 'item', 'Ox Wagon', {}), ON).ok, true);
    assert.equal(h.query('gear.carry', {}).capacity, 30 + 60 + 150);
    const off = createHarness([core()]);
    assert.equal(off.capture(line('+', 'item', 'Rented Hand Cart', {}), OFF).ok, true);
    assert.equal(Object.values(off.state.domains.inventory.defs)[0].carry, undefined, 'off: the story never gives a capacity');
});

test('the gear switch lives in Settings → RPG, off the Features list, and counts only while the RPG is on', async t => {
    const ctx = await page(t, { feature: true });
    const host = ctx.host;
    assert.equal(host.sdk.feature('story-block.gear'), false);
    assert.equal(host.sdk.features().some(feature => feature.id === 'story-block.gear'), true, 'still a feature');
    const win = ctx.ui.openSettings();
    win.select('features');
    await settle();
    assert.equal(ctx.doc.querySelector('[data-feature="story-block.gear"]'), null, 'not in the Features list');
    win.select('rpg');
    await settle();
    const card = ctx.doc.querySelector('[data-ss-section="rpg"] [data-card="gear"]');
    assert.equal(card.querySelector('.rpg-set-title').textContent, 'Gear in fights');
    assert.equal(card.querySelector('[aria-pressed="true"]').textContent, 'Off');
    card.querySelector('.rpg-chip[data-value="on"]').click();
    await settle();
    assert.equal(host.sdk.feature('story-block.gear'), true);
    assert.equal(ctx.doc.querySelector('[data-ss-section="rpg"] [data-card="gear"] [aria-pressed="true"]').textContent, 'On');
    // With the RPG off the gear answers nothing, whatever is stored.
    host.features.set('story-block.rpg', false);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }), null);
});

test('with the RPG off gear is inert even if its switch is on', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true } } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare', '+ item Stone | qty: 60']));
    assert.equal(defNamed(host, 'Iron Sword').slot, null);
    assert.equal(host.sdk.query('inventory.encumbrance').encumbered, false);
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }), null);
});

test('the narrator\'s equipped: word puts a new item on, rarity: and slot: words take effect, one item per slot per owner', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare | equipped: weapon', '+ item Hunting Knife | slot: weapon | equipped: weapon', '+ item Wool Cap | equipped: head', '+ item Jade Ring | equipped: accessory', '+ item Onyx Ring | equipped: accessory', '+ item Amber Ring | equipped: accessory', '+ item Rope | equipped: yes', '+ item Oak Shield | equipped: sword']));
    const rows = host.sdk.query('inventory.items');
    const on = name => rows.find(item => item.name === name);
    assert.deepEqual([on('Iron Sword').equipped, on('Iron Sword').rarity], [null, 'rare'], 'put away by the knife: one item per slot');
    assert.deepEqual([on('Hunting Knife').equipped, on('Hunting Knife').equippedBy, on('Hunting Knife').slot], ['weapon', 'party', 'weapon']);
    assert.equal(on('Wool Cap').equipped, 'head');
    assert.deepEqual([on('Jade Ring').equipped, on('Onyx Ring').equipped, on('Amber Ring').equipped], [null, 'accessory-2', 'accessory-1'], 'two accessory places; the third took the first');
    assert.equal(on('Rope').equipped, null, 'goods are not worn');
    assert.equal(on('Oak Shield').equipped, null, 'a word that is no slot, or does not fit, is passed over');
    assert.equal(Object.hasOwn(on('Rope'), 'equippedBy'), false, 'only what is worn');
    // A common piece gives its one point (every rarity has a budget now).
    const gear = host.sdk.query('inventory.gear', { owner: 'party' });
    assert.deepEqual(gear.slots.weapon, { name: 'Hunting Knife', stats: { STR: 1 }, soak: 0, cond: 100, broken: false }, 'a common piece gives one point');
    assert.deepEqual(gear.slots.head, { name: 'Wool Cap', stats: { VIT: 1 }, soak: 0, cond: 100, broken: false });   // rarity gives no soak: only an item's own soak does
    assert.equal(gear.slots['accessory-1'].name, 'Amber Ring');
    assert.equal(gear.slots['accessory-2'].name, 'Onyx Ring');
    assert.equal(gear.slots.cloak, null);
    // The reader's command: item.equip { stack, owner, slot }.
    const sword = on('Iron Sword').stack;
    assert.equal((await host.sdk.command('item.equip', { stack: sword, owner: 'party', slot: 'weapon' })).ok, true);
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Hunting Knife').equipped, null, 'the knife is put away');
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus.DEX, 3);
    const refuse = async payload => (await host.sdk.command('item.equip', payload)).ok;
    assert.equal(await refuse({ stack: sword, slot: 'head' }), false, 'a sword does not fit the head');
    assert.equal(await refuse({ stack: sword, owner: 'ac_other001', slot: 'weapon' }), false, 'not that owner\'s');
    assert.equal(await refuse({ stack: sword, slot: 'nowhere' }), false);
    assert.equal((await host.sdk.command('item.equip', { stack: on('Jade Ring').stack, slot: 'accessory-2' })).ok, true);
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Onyx Ring').equipped, null);
    // Replay: a rebuild keeps all of it.
    const live = JSON.stringify(host.sdk.query('inventory.items').map(({ stack, ...row }) => row));
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('inventory.items').map(({ stack, ...row }) => row)), live);
});

test('off: equipped:, slot: and rarity: words change nothing and the rows have no equippedBy; item.equip is refused', async t => {
    const host = await fresh(t, { gear: false, modules: [] });
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare | equipped: weapon']));
    const row = host.sdk.query('inventory.items')[0];
    assert.deepEqual([row.rarity, row.equipped, Object.hasOwn(row, 'equippedBy')], ['common', null, false]);
    assert.equal((await host.sdk.command('item.equip', { stack: row.stack, slot: 'weapon' })).ok, false);
});
