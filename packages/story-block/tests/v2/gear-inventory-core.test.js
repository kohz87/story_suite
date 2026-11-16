// Gear in fights, inventory side (`story-block.gear`, off by default; docs/v2/GEAR.md): budgets, slots, rarity, wear, carry, and off-by-default parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, capacityFor, gearBudget, gearRarityOf, gearSlotOf, slotWordOf, stepDown } from '../../src/v2/domains/gear.js';
import { validateInventory } from '../../src/v2/domains/inventory.js';
import { validatePack } from '../../src/v2/packs/validate.js';
import { itemDef } from '../../src/v2/packs/content.js';
import { createHost } from '../../testkit/index.js';
import { createCoreModule } from '../../src/v2/domains/index.js';
import { createHarness, line } from './domains/helpers/fake-ctx.js';
import { core, def, stack, stocked } from './domains/fixtures.js';
import { pack } from './packs/helpers/fixtures.js';
import { OFF, ON, defNamed, equip, fresh, reply, tail, wear } from './gear-inventory.helpers.js';

test('the stat budget is by rarity (1, 2, 3, 4, 5); a pack item may set its own 0…6; the story never does', () => {
    assert.deepEqual(['common', 'uncommon', 'rare', 'epic', 'legendary'].map(rarity => gearBudget({ id: 'story/x', rarity })), [1, 2, 3, 4, 5]);
    assert.equal(gearBudget({ id: 'pack.p/sword', rarity: 'common', bonus: 6 }), 6, 'a pack item\'s own bonus');
    assert.equal(gearBudget({ id: 'pack.p/sword', rarity: 'rare', bonus: 0 }), 0, 'even 0');
    assert.equal(gearBudget({ id: 'pack.p/sword', rarity: 'rare', bonus: 7 }), 3, 'out of range: the rarity\'s');
    assert.equal(gearBudget({ id: 'story/sword', rarity: 'rare', bonus: 6 }), 3, 'a story def\'s bonus is not read');
    assert.deepEqual(GEAR.budget, { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 });
    // The validator holds a def's bonus to 0…6.
    const module = core();
    const state = stocked(module);
    state.domains.inventory.defs['pack.fantasy/iron-sword'].bonus = 6;
    assert.deepEqual(validateInventory(state.domains.inventory), []);
    state.domains.inventory.defs['pack.fantasy/iron-sword'].bonus = 7;
    assert.match(validateInventory(state.domains.inventory).join(' '), /gear bonus of 7; it is a whole number from 0 to 6/);
    state.domains.inventory.defs['pack.fantasy/iron-sword'].bonus = 1.5;
    assert.equal(validateInventory(state.domains.inventory).length, 1);
});

test('a pack item\'s bonus is validated (0…6) and comes through as its def\'s; the story-made copy of a pack item loses it', () => {
    const ok = validatePack(pack({ content: { items: [{ name: 'Sunblade', kind: 'equipment', slot: 'weapon', rarity: 'rare', bonus: 5 }] } }));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.equal(ok.pack.content.items[0].bonus, 5);
    assert.equal(itemDef({ ...ok.pack.content.items[0], id: 'pack.x/sunblade' }).bonus, 5);
    for (const bonus of [7, -1, 1.5, '2']) {
        const bad = validatePack(pack({ content: { items: [{ name: 'Sunblade', kind: 'equipment', slot: 'weapon', bonus }] } }));
        assert.equal(bad.ok, false, `bonus ${bonus}`);
        assert.ok(bad.errors.some(error => /bonus must be a whole number from 0 to 6/.test(error.message)));
    }
    assert.equal(validatePack(pack({ content: { items: [{ name: 'Sunblade', kind: 'equipment', slot: 'weapon' }] } })).ok, true, 'optional');
});

test('the slot comes from the line\'s kind word, else the name; the rarity from rarity: or quality: words', () => {
    const slot = (kind, name) => gearSlotOf(kind, name);
    for (const [name, want] of [['Iron Sword', 'weapon'], ['Hand Axe', 'weapon'], ['Short Bow', 'weapon'], ['Dagger', 'weapon'], ['Boar Spear', 'weapon'], ['Oak Staff', 'weapon'],
        ['Chain Mail', 'body'], ['Leather Jerkin', 'body'], ['Plate', 'body'], ['Bronze Cuirass', 'body'], ['Grey Robe', 'body'],
        ['Oak Shield', 'off-hand'], ['Buckler', 'off-hand'], ['Iron Helmet', 'head'], ['Wool Cap', 'head'], ['Rain Hood', 'head'], ['Green Cloak', 'cloak'], ['Short Cape', 'cloak'],
        ['Old Mantle', 'cloak'], ['Walking Boots', 'feet'], ['Sandals', 'feet'], ['Jade Ring', 'accessory'], ['Silver Amulet', 'accessory'], ['Pendant', 'accessory'], ['Leather Belt', 'accessory'], ['Travel Pack', null], ['Leather Satchel', null], ['Sack Bag', null], ['Two Swords', 'weapon'], ['Steel Blade', 'weapon'], ['War Hammer', 'weapon'], ['Oak Wand', 'weapon']]) {
        assert.equal(slot(null, name), want, name);
    }
    assert.equal(slot(null, 'Rope'), null);
    assert.equal(slot(null, 'Swordfish stew'), null, 'whole words only');
    assert.equal(slot('weapon', 'Rope'), 'weapon', 'the kind word wins');
    assert.equal(slot('Armor', 'Iron Sword'), 'body', 'US spelling, and over the name');
    assert.equal(slot('off-hand', 'Rope'), 'off-hand');
    assert.equal(slot('accessory-2', 'Rope'), 'accessory-2');
    assert.equal(slotWordOf('Shield'), 'off-hand');
    assert.equal(slot('potion', 'Iron Sword'), 'weapon', 'a kind that is no slot is passed over');
    const rarity = word => gearRarityOf(word);
    assert.deepEqual(['crude', 'common', 'fine', 'sturdy', 'rare', 'masterwork', 'epic', 'heroic', 'legendary', 'fabled'].map(rarity),
        ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary']);
    assert.equal(rarity('a fine blade'), 'uncommon');
    assert.equal(rarity('shiny'), null);
    assert.equal(rarity('+3'), null);
});

test('a story + item line gets its slot and rarity from words only; numbers are ignored; legendary is held to epic', () => {
    const h = createHarness([core()]);
    const add = (name, labels, opts = ON) => {
        const out = h.capture(line('+', 'item', name, labels), opts);
        assert.equal(out.ok, true, out.message);
        return Object.values(h.state.domains.inventory.defs).find(item => item.name === name);
    };
    const sword = add('Iron Sword', { rarity: 'rare', atk: '9', bonus: '6', carry: '99', value: '500' });
    assert.deepEqual([sword.slot, sword.kind, sword.rarity, sword.stack, sword.bonus, sword.carry, sword.atk], ['weapon', 'equipment', 'rare', false, undefined, undefined, undefined]);
    assert.equal(gearBudget(sword), 3);
    assert.deepEqual(sword.stats, { DEX: 3 }, 'a sword raises DEX by its whole budget');
    const shield = add('Oak Shield', { quality: 'fine' });
    assert.deepEqual([shield.slot, shield.rarity], ['off-hand', 'uncommon']);
    const mail = add('Chain Mail', { rarity: 'legendary' });
    assert.deepEqual([mail.slot, mail.rarity], ['body', 'epic'], 'held to epic: the story alone does not make a legend');
    const kind = add('Heirloom', { kind: 'armor', rarity: 'crude' });
    assert.deepEqual([kind.slot, kind.rarity], ['body', 'common']);
    const plain = add('Rope', { rarity: 'rare' });
    assert.deepEqual([plain.slot, plain.kind, plain.rarity], [null, 'goods', 'rare'], 'a rarity without a slot is still a rarity');
    const bag = add('Travel Pack', {});
    assert.deepEqual([bag.slot, bag.kind, bag.carry], [null, 'goods', undefined], 'a bag is no slot, and the story never gives it a capacity');
    assert.deepEqual(h.query('inventory.definitions', { ids: [sword.id] })[0].rarity, 'rare');
    // A module's own grant keeps the rarity it gives (a quest reward may be legendary).
    const granted = h.run('inventory.grant', { def: { name: 'Sun Crown', rarity: 'legendary' }, qty: 1 }, { caller: 'zz-quest', cause: 'story', ...ON });
    assert.equal(granted.ok, true, granted.message);
    assert.equal(Object.values(h.state.domains.inventory.defs).find(item => item.name === 'Sun Crown').rarity, 'legendary');
});

test('with the feature off a story item is exactly as before: no slot, goods, the default rarity', () => {
    const h = createHarness([core()]);
    for (const opts of [OFF, {}]) {
        const name = `Iron Sword ${opts === OFF ? 1 : 2}`;
        assert.equal(h.capture(line('+', 'item', name, { rarity: 'epic', kind: 'weapon' }), opts).ok, true);
        const made = Object.values(h.state.domains.inventory.defs).find(item => item.name === name);
        assert.deepEqual([made.slot, made.kind, made.rarity, made.stack, Object.hasOwn(made, 'bonus')], [null, 'goods', 'common', true, false], name);
    }
    assert.equal(h.run('gear.wear', { owner: 'party', slot: 'weapon', step: 'tear' }, { cause: 'system', ...OFF }).code, 'REFUSED');
});

test('inventory.gear: the worn pieces with their stats and condition; a broken piece gives nothing; wear goes down the condition words', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare', '+ item Oak Shield | quality: fine', '+ item Chain Mail | rarity: epic', '+ item Rope']));
    const empty = Object.fromEntries(['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory-1', 'accessory-2'].map(place => [place, null]));
    const zero = { STR: 0, VIT: 0, AGI: 0, DEX: 0, INT: 0, LUK: 0, CHA: 0 };
    // load 13: Iron Sword 3 (weapon) + Oak Shield 4 (off-hand) + Chain Mail 5 (body) + Rope 1, by the default weight of each slot
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: 'party' }), { on: true, owner: 'party', slots: empty, statBonus: zero, soak: { total: 0, pieces: [] }, carry: { load: 13, capacity: 30, encumbered: false, penalty: 0, sources: [{ name: 'The reader', carry: 30 }] } });
    for (const name of ['Iron Sword', 'Oak Shield', 'Chain Mail']) await equip(host, name);
    const gear = () => host.sdk.query('inventory.gear', { owner: 'party' });
    const slot = place => gear().slots[place];
    assert.deepEqual([slot('weapon'), slot('off-hand'), slot('body')], [
        { name: 'Iron Sword', stats: { DEX: 3 }, soak: 0, cond: 100, broken: false }, { name: 'Oak Shield', stats: { VIT: 2 }, soak: 0, cond: 100, broken: false }, { name: 'Chain Mail', stats: { VIT: 4 }, soak: 0, cond: 100, broken: false }]);
    assert.deepEqual(gear().statBonus, { ...zero, DEX: 3, VIT: 6 }, 'summed over what is worn');
    assert.deepEqual(host.sdk.query('inventory.statBonus', { owner: 'party' }), gear().statBonus);
    await host.send('Fight.', reply('A hard blow.', ['~ hit weapon 1']));
    assert.deepEqual(slot('weapon'), { name: 'Iron Sword', stats: { DEX: 3 }, soak: 0, cond: 69, broken: false }, 'worn still gives its stats');
    assert.equal(host.sdk.receipts().at(-1).receipt.summary, 'Iron Sword wears (100 → 69).');
    assert.equal(host.sdk.receipts().at(-1).receipt.data.steps, 1);
    const stackId = wear(host, 'Iron Sword').stack;
    assert.equal(host.sdk.query('inventory.condition', { stack: stackId }).cond, 69, 'the same condition events inventory.wear writes');
    await host.send('More.', reply('Again.', ['~ hit weapon 1']));
    assert.equal(slot('weapon').cond, 39, 'worn → torn');
    await host.send('Last.', reply('It snaps.', ['~ hit weapon 1']));
    assert.deepEqual(slot('weapon'), { name: 'Iron Sword', stats: {}, soak: 0, cond: 0, broken: true }, 'broken: no stats');
    assert.deepEqual(gear().statBonus, { ...zero, VIT: 6 });
    assert.equal(host.sdk.receipts().at(-1).receipt.summary, 'Iron Sword breaks.');
    await host.send('Again.', reply('Splinters.', ['~ hit weapon 1']));
    assert.equal(host.sdk.receipts().at(-1).receipt.summary, 'Iron Sword is already broken.');
    assert.deepEqual([slot('off-hand').stats, slot('body').stats], [{ VIT: 2 }, { VIT: 4 }], 'the other pieces are as they were');
    // Two steps at once; the defence slot is the body armour, else the off-hand.
    await host.send('Smash.', reply('Crack.', ['~ hit defence 2']));
    assert.deepEqual([slot('body').cond, slot('off-hand').cond], [39, 100], 'good → worn → torn');
    await host.sdk.command('inventory.unequip', { stack: wear(host, 'Chain Mail').stack });
    await host.send('Bash.', reply('Dent.', ['~ hit defence 1']));
    assert.equal(slot('off-hand').cond, 69, 'no body armour: the off-hand');
    // A wrong steps or slot is refused (the line fails, nothing moves).
    for (const bad of ['~ hit weapon 9', '~ hit helm 1']) {
        const before = JSON.stringify(gear());
        await host.send('Bad.', reply('No.', [bad]));
        assert.equal(JSON.stringify(gear()), before, bad);
        assert.ok(host.turn.problems().length > 0, bad);
    }
    // Not from a button or a story line of its own.
    assert.equal((await host.sdk.command('gear.wear', { owner: 'party', slot: 'off-hand', steps: 1 })).ok, false);
    assert.equal(slot('off-hand').cond, 69);
    assert.deepEqual([100, 69, 39, 0].map(cond => stepDown(cond)), [69, 39, 0, 0]);
});

test('gear.wear is the system\'s or a module\'s call, only while the feature is on, and only for a piece worn in the slot', () => {
    const module = core();
    const state = stocked(module);
    state.domains.inventory.defs['pack.fantasy/iron-sword'].slot = 'weapon';
    state.domains.inventory.stacks.it_sword001.equipped = 'weapon';
    const h = createHarness([module], { state });
    const ask = { owner: 'party', slot: 'weapon', steps: 1 };
    for (const cause of ['ui', 'story']) assert.equal(h.run('gear.wear', ask, { cause, ...ON }).code, 'REFUSED', cause);
    assert.equal(h.run('gear.wear', ask, { cause: 'system', ...OFF }).code, 'REFUSED', 'feature off');
    assert.equal(h.run('gear.wear', ask, { cause: 'system', extra: { feature: id => id === 'story-block.gear' } }).code, 'REFUSED', 'the RPG off');
    assert.equal(h.run('gear.wear', { ...ask, slot: 'off-hand' }, { cause: 'system', ...ON }).code, 'NOT_FOUND');
    assert.equal(h.run('gear.wear', { ...ask, slot: 'ring' }, { cause: 'system', ...ON }).code, 'INVALID');
    assert.equal(h.run('gear.wear', { ...ask, steps: 0 }, { cause: 'system', ...ON }).code, 'INVALID');
    const out = h.run('gear.wear', ask, { cause: 'system', ...ON });
    assert.equal(out.ok, true, out.message);
    assert.deepEqual(out.result.data, { owner: 'party', slot: 'weapon', stack: 'it_sword001', def: 'pack.fantasy/iron-sword', steps: 1, amount: 31, before: 100, now: 69, broken: false });
    assert.equal(h.run('gear.wear', { ...ask, steps: 2 }, { caller: 'zz-fight', cause: 'story', ...ON }).ok, true, 'a module\'s call');
    assert.equal(h.query('inventory.condition', { stack: 'it_sword001' }).cond, 0);
    assert.equal(h.run('gear.wear', { ...ask, slot: 'armour' }, { cause: 'system', ...ON }).code, 'NOT_FOUND', 'armour is the body slot');
});

test('carry: 10 + 2 × STR, bags add their pack capacity; over it the party is encumbered (only with the feature on)', async t => {
    assert.equal(capacityFor(10), 30);
    assert.equal(capacityFor(1), 12);
    assert.equal(capacityFor(20), 50);
    assert.equal(capacityFor(99), 50, 'STR is held to 1…20');
    assert.equal(capacityFor(null), 30, 'a missing STR counts as the default 10');
    const host = await fresh(t);
    await host.send('Stones.', reply('Heavy.', ['+ item Stone | qty: 30']));
    // (From 100 % the party is encumbered: load at or over the capacity; one under it is not.)
    assert.deepEqual(host.sdk.query('inventory.encumbrance'), { on: true, encumbered: true, party: true, who: [], load: 30, capacity: 30, penalty: -2, stats: ['AGI', 'DEX'] });
    await host.send('One more.', reply('Too much.', ['+ item Brick | qty: 2']));
    const last = host.sdk.receipts().at(-1).receipt;
    assert.match(last.summary, /^The party gains Brick ×2\. The party now carries more than it can and is encumbered/);
    assert.equal(last.data.encumbered, true);
    assert.deepEqual(host.sdk.query('inventory.encumbrance'), { on: true, encumbered: true, party: true, who: [], load: 32, capacity: 30, penalty: -2, stats: ['AGI', 'DEX'] });
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: 'party' }).carry, { load: 32, capacity: 30, encumbered: true, penalty: -2, sources: [{ name: 'The reader', carry: 30 }] });
    await host.send('On.', reply('The road.', ['+ coin 1']));
    assert.match(tail(host), /^Encumbered \(carrying more than they can\): the party \(32\/30\); AGI and DEX checks -2 until something is put down\.$/m);
    // The reader's own take past the limit is refused, as with any carry module.
    await host.send('Look.', reply('A crate.', ['? loot Feather']));
    const sid = host.store.carrierSid(host.store.headIndex());
    const refused = await host.sdk.command('inventory.lootTake', { sid, pick: [0] });
    assert.deepEqual([refused.ok, refused.code], [false, 'REFUSED']);
    assert.match(refused.message, /party cannot carry that: 32 of 30 carried/);
    await host.send('Drop.', reply('Lighter.', ['- item Stone | qty: 3']));
    assert.equal(host.sdk.query('inventory.encumbrance').encumbered, false, '29 of 30 is under the limit (30 of 30 is encumbered)');
});

test('carry: a bag adds its carry while owned; a person has their own; coins weigh nothing; a carry module that answers items.carry is the one asked', () => {
    const module = createCoreModule({ hooks: () => [], settings: () => ({}), extras: { gearOn: () => true } });
    const state = stocked(module);
    const inv = state.domains.inventory;
    inv.defs['pack.fantasy/satchel'] = def('pack.fantasy/satchel', 'Deep Satchel', { kind: 'goods', carry: 20 });
    inv.stacks.it_bag00001 = stack('it_bag00001', 'pack.fantasy/satchel', 1);
    inv.defs['story/ducats'] = def('story/ducats', 'Ducats', { kind: 'money' });
    inv.stacks.it_ren00001 = stack('it_ren00001', 'story/rope', 4, { owner: 'ac_ren00001' });
    const h = createHarness([module], { state });
    const carry = () => h.query('gear.carry', {});
    // The party: 10 + 2 × 10 for the one reader, the worn bag counts only while worn.
    assert.equal(carry().capacity, 30 + 30 + 20, 'the reader\'s 30, Ren\'s 30, the bag\'s 20: a bag adds its carry while owned');
    assert.deepEqual(carry().bonuses, [{ stack: 'it_bag00001', carry: 20 }], 'the Inventory shows the bag\'s +20 as before');
    assert.equal(carry().capacity, 80);
    assert.deepEqual(carry().people, [{ id: 'ac_ren00001', name: 'ac_ren00001', load: 4, capacity: 30 }]);
    assert.equal(carry().load, 3 + 1 + 1 + 2 + 1 + 1 + 1 + 4, 'rope 3, sword, dagger, potions 2 + 1, lantern, bag, Ren\'s rope 4');
    // Fits: the party up to its capacity, a person up to their own.
    const fits = (owner, qty) => h.query('gear.carry', { owner, add: [{ defId: 'story/rope', qty }] });
    const room = carry().capacity - carry().load;
    assert.deepEqual([fits('party', room).ok, fits('party', room + 1).ok], [true, false]);
    assert.match(fits('party', room + 1).message, /^The party cannot carry that: \d+ of 80 carried\.$/);
    assert.deepEqual([fits('ac_ren00001', 26).ok, fits('ac_ren00001', 27).ok], [true, false]);
    assert.match(fits('ac_ren00001', 27).message, /^ac_ren00001 cannot carry that: 4 of 30 carried\.$/);
    assert.equal(h.query('gear.carry', { owner: 'party', move: true, add: [{ defId: 'story/rope', qty: 500 }] }).ok, true, 'a hand-over inside the party keeps the load');
    // A money def adds no weight; the feature off: nothing answers.
    assert.equal(h.query('gear.carry', { owner: 'party', add: [{ defId: 'story/ducats', qty: 5000 }] }).ok, true);
    const off = createHarness([createCoreModule({ hooks: () => [], settings: () => ({}) })], { state });
    assert.equal(off.query('gear.carry', {}), null);
    assert.equal(off.query('inventory.gear', { owner: 'party' }), null);
});

test('off by default: the same replies give the same receipts, defs and prompt tails as a host that never heard of gear', async t => {
    const lines = ['+ item Iron Sword | rarity: rare', '+ item Stone | qty: 45', '+ coin 12'];
    const a = await fresh(t, { gear: false, modules: [] });
    const b = await createHost({ modules: [], settings: { features: { 'story-block.gear': false } } });
    t.after(() => b.close());
    await b.send('Hello.', 'The road.');
    for (const host of [a, b]) await host.send('Loot.', reply('Gear.', lines));
    assert.deepEqual(a.sdk.receipts().map(entry => entry.receipt.summary), b.sdk.receipts().map(entry => entry.receipt.summary));
    const shape = host => { const inv = host.head().domains.inventory; return [inv.defs, Object.values(inv.stacks).map(item => [item.def, item.qty, item.equipped]), inv.wallets]; };
    assert.deepEqual(shape(a), shape(b));
    const sword = defNamed(a, 'Iron Sword');
    assert.deepEqual([sword.slot, sword.kind, sword.rarity], [null, 'goods', 'common']);
    assert.equal(a.sdk.query('inventory.encumbrance').encumbered, false);
    assert.equal(a.sdk.query('inventory.gear', { owner: 'party' }), null, 'off: the gear query answers nothing');
    assert.doesNotMatch(a.sdk.receipts().map(entry => entry.receipt.summary).join('\n'), /encumbered/);
    await a.send('On.', reply('Road.', ['+ coin 1']));
    assert.doesNotMatch(tail(a), /Encumbered/);
    assert.equal((await a.sdk.command('gear.wear', { owner: 'party', slot: 'weapon', step: 'tear' })).ok, false);
});
