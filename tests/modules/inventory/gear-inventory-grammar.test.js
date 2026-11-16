// Gear in fights, inventory side (`story-block.gear`, off by default; docs/v2/GEAR.md): stats, repair, rarity limits, grammar words, compound names, reread itemIds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, defaultStat, gearSlotOf, itemCarryOf, kindCarry, statsFor, statsOf, stepUp, withinBudget } from '../../src/v2/domains/gear.js';
import { validatePack } from '../../../../packs/validate.js';
import { createHost } from '../../testkit/index.js';
import { createCoreModule } from '../../src/v2/domains/index.js';
import { createHarness, line } from './domains/helpers/fake-ctx.js';
import { core, stocked } from './domains/fixtures.js';
import { pack } from '../../../../tests/packs/helpers/fixtures.js';
import { FIGHT, ITEM_LINE, ON, defNamed, equip, fresh, gearCore, reply, staticOf, tail, wear } from './gear-inventory.helpers.js';

test('stats: the narrator\'s named stats are held to the budget; with none named the kind or name picks; every slot gives them; a pack lists its own', async () => {
    assert.deepEqual(statsOf({ dex: 2, STR: '3', cha: -1, luk: 1.5, foo: 4 }), { DEX: 2 });
    assert.deepEqual(withinBudget({ STR: 2, DEX: 2, CHA: 1 }, 3), { STR: 2, DEX: 1 }, 'in the order of the seven stats, cut at the budget');
    assert.deepEqual(withinBudget({ STR: 1, VIT: 1, AGI: 1 }, 4), { STR: 1, VIT: 1 }, 'and at most two different stats');
    assert.deepEqual(withinBudget({ STR: 2 }, 0), {});
    const pick = (name, slot) => defaultStat(name, slot);
    assert.deepEqual(['Steel Blade', 'Iron Sword', 'Hunting Bow', 'Dagger', 'Hand Axe', 'War Hammer', 'Heavy Club', 'Boar Spear', 'Oak Staff', 'Wand', 'Old Tome', 'Chain Mail', 'Oak Shield', 'Iron Helm', 'Walking Boots', 'Green Cloak', 'Jade Ring', 'Silver Amulet', 'Pendant'].map(name => pick(name, null)),
        ['DEX', 'DEX', 'DEX', 'DEX', 'STR', 'STR', 'STR', 'STR', 'INT', 'INT', 'INT', 'VIT', 'VIT', 'VIT', 'AGI', 'AGI', 'LUK', 'LUK', 'LUK']);
    assert.deepEqual(['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory'].map(slot => pick('Thing', slot)), ['STR', 'VIT', 'VIT', 'VIT', 'AGI', 'AGI', 'LUK'], 'the slot\'s default');
    const h = createHarness([core()]);
    const add = (name, labels) => { assert.equal(h.capture(line('+', 'item', name, labels), ON).ok, true); return Object.values(h.state.domains.inventory.defs).find(item => item.name === name); };
    assert.deepEqual(add('Cane Sword', { rarity: 'rare', dex: '+2' }).stats, { DEX: 2 });
    assert.deepEqual(add('Hexed Hammer', { rarity: 'rare', str: '2', int: '2' }).stats, { STR: 2, INT: 1 }, 'held to a budget of 3');
    assert.deepEqual(add('Split Axe', { rarity: 'epic', str: '1', agi: '1', cha: '9' }).stats, { STR: 1, AGI: 1 }, 'at most two stats');
    assert.deepEqual(add('Plain Dagger', { dex: '3' }).stats, { DEX: 1 }, 'a common piece is held to its budget of 1');
    assert.deepEqual(add('Iron Helm', { rarity: 'uncommon' }).stats, { VIT: 2 });
    assert.deepEqual(add('Silk Cloak', { rarity: 'fine' }).stats, { AGI: 2 });
    assert.deepEqual(add('Jade Ring', { rarity: 'rare' }).stats, { LUK: 3 });
    assert.deepEqual(add('Plain Belt', { rarity: 'rare' }).stats, { LUK: 3 }, 'a belt is an accessory: the slot\'s own');
    assert.equal(add('Rope', { rarity: 'rare', dex: '2' }).stats && Object.keys(add('Rope', {}).stats).length, 0, 'no slot, no stats');
    // A pack lists its own stats, held to the rarity's budget unless the pack sets a budget of its own.
    const rare = { id: 'pack.p/blade', name: 'Sun Blade', kind: 'equipment', slot: 'weapon', rarity: 'rare' };
    assert.deepEqual(statsFor({ ...rare, stats: { DEX: 2 } }), { DEX: 2 });
    assert.deepEqual(statsFor({ ...rare, stats: { DEX: 5 } }), { DEX: 3 }, 'held to the rarity budget');
    assert.deepEqual(statsFor({ ...rare, stats: { DEX: 5 }, bonus: 5 }), { DEX: 5 }, 'unless the pack sets its own budget');
    assert.deepEqual(statsFor({ ...rare }), { DEX: 3 }, 'none listed: the name\'s pick');
    assert.deepEqual(statsFor({ ...rare, rarity: 'common' }), { DEX: 1 });
    assert.equal(GEAR.effectiveMax, 30);
});

test('every slot gives its stats through inventory.gear, and a broken piece takes its stats away', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Oak Staff | rarity: rare | equipped: weapon', '+ item Iron Helm | rarity: uncommon | equipped: head', '+ item Silk Cloak | rarity: uncommon | equipped: cloak', '+ item Walking Boots | rarity: uncommon | equipped: feet', '+ item Jade Ring | rarity: epic | equipped: accessory', '+ item Travel Pack']));
    const bonus = () => host.sdk.query('inventory.statBonus', { owner: 'party' });
    assert.deepEqual(bonus(), { STR: 0, VIT: 2, AGI: 4, DEX: 0, INT: 3, LUK: 4, CHA: 0 });
    await host.send('Smash.', reply('Crash.', ['~ hit weapon 3']));
    assert.equal(bonus().INT, 0, 'broken: no stats');
    assert.equal(host.sdk.query('inventory.items').find(item => item.name === 'Travel Pack').equipped, null, 'a bag is worn nowhere');
});

test('repair in the story: mend is one condition word up, restore is back to Good; a broken piece gets its stats back; the prompt words follow', async t => {
    assert.deepEqual([0, 39, 69, 100].map(cond => stepUp(cond)), [39, 69, 100, 100]);
    assert.equal(stepUp(0, true), 100);
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Cane Sword | rarity: rare | equipped: weapon']));
    const gear = () => host.sdk.query('inventory.gear', { owner: 'party' });
    const sword = () => wear(host, 'Cane Sword').stack;
    const condNow = () => host.sdk.query('inventory.condition', { stack: sword() }).cond;
    const next = async text => { await host.send('Go.', reply('On.', [text])); await host.send('Go.', reply('On.', ['+ coin 1'])); };
    await host.send('Hit.', reply('Blows.', ['~ hit weapon 3']));
    assert.deepEqual([condNow(), gear().statBonus.AGI], [0, 0], 'broken: no stats');
    await next('~ item Cane Sword — the smith reground it | repair: mend');
    assert.equal(host.sdk.receipts().at(-2).receipt.summary, 'Cane Sword is mended (0 → 39/100).');
    assert.deepEqual([condNow(), gear().statBonus.AGI], [39, 3], 'torn: its stats are back');
    assert.match(tail(host), /^Equipped: Cane Sword \(torn\) \[weapon\]$/m);
    await next('~ item Cane Sword | repair: patched');
    assert.match(tail(host), /^Equipped: Cane Sword \(worn\) \[weapon\]$/m);
    await next('~ item Cane Sword | repair: mended');
    assert.equal(condNow(), 100);
    assert.match(tail(host), /^Equipped: Cane Sword \[weapon\]$/m, 'Good: unmarked again');
    await host.send('Hit.', reply('Blows.', ['~ hit weapon 3']));
    await next('~ item Cane Sword — reforged | repair: restore');
    assert.deepEqual([condNow(), gear().slots.weapon.broken], [100, false], 'restore goes straight back to Good');
    // Twice in one reply: the second is refused (once per piece per reply); a word that means nothing is refused.
    await host.send('Hit.', reply('Blows.', ['~ hit weapon 2']));
    await host.send('Smith.', reply('Work.', ['~ item Cane Sword | repair: mend', '~ item Cane Sword | repair: mend']));
    assert.equal(condNow(), 69, 'one step, once');
    await host.send('Smith.', reply('Work.', ['~ item Cane Sword | repair: shiny']));
    assert.equal(condNow(), 69);
    // Replay: a swipe takes the repair back with its reply; a rebuild and a reload agree.
    const view = () => JSON.stringify([condNow(), gear().statBonus]);
    await host.send('Smith.', reply('Work.', ['~ item Cane Sword | repair: restore']));
    assert.equal(condNow(), 100);
    const live = view();
    host.store.rebuild();
    assert.equal(view(), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [FIGHT], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.equal(JSON.stringify(loaded.sdk.query('inventory.gear', { owner: 'party' }).statBonus), JSON.stringify(gear().statBonus));
    await host.swipe(reply('No smith after all.', ['+ coin 1']));
    assert.equal(condNow(), 69, 'the swipe took the repair back');
});

test('off: the repair word does nothing (as before) and the wear word still works', async t => {
    const host = await fresh(t, { gear: false, modules: [] });
    await host.send('Loot.', reply('Gear.', ['+ item Cane Sword']));
    await host.send('Rust.', reply('Rust.', ['~ item Cane Sword — rusted | wear: ruin']));
    const stack = wear(host, 'Cane Sword').stack;
    const before = host.sdk.query('inventory.condition', { stack }).cond;
    await host.send('Smith.', reply('Work.', ['~ item Cane Sword — mended | repair: restore']));
    assert.equal(host.sdk.query('inventory.condition', { stack }).cond, before);
});

test('any stat on any item: a blade with AGI and DEX, held to the budget and two stats; a default only when none is named', () => {
    const h = createHarness([gearCore()]);
    const add = (name, labels) => { assert.equal(h.capture(line('+', 'item', name, labels, 'forged by a master in Auvoth'), ON).ok, true); return Object.values(h.state.domains.inventory.defs).find(item => item.name === name); };
    assert.deepEqual(add('Shadowsteel Blade', { rarity: 'rare', agi: '+1', dex: '+1' }).stats, { AGI: 1, DEX: 1 }, 'a blade with AGI is fine');
    assert.deepEqual(add('Heavy Blade', { rarity: 'rare', str: '+5' }).stats, { STR: 3 }, 'held to the budget of 3');
    assert.deepEqual(add('Odd Blade', { rarity: 'legendary', str: '1', agi: '1', dex: '1', int: '1' }).stats, { STR: 1, AGI: 1 }, 'epic here (4), two stats');
    assert.deepEqual(add('Bare Blade', { rarity: 'rare' }).stats, { DEX: 3 }, 'none named: the default, the whole budget');
    assert.deepEqual(add('Wool Hood', { rarity: 'uncommon', cha: '1' }).stats, { CHA: 1 }, 'any item');
});

test('rarity limits: legendary only when the same reply earned it, else epic with one Problems line', () => {
    const problems = [];
    const earned = { id: 'zz-earned', name: 'earned', version: '0.0.0', queries: { 'story.legendaryEarned': () => true } };
    const make = (modules, placeName) => {
        const module = createCoreModule({ hooks: () => [], settings: () => ({}), problem: entry => problems.push(entry), extras: { gearOn: () => true } });
        const state = stocked(module);
        if (placeName) state.domains.scene.place = { name: placeName, kind: '', region: '' };
        return createHarness([module, ...modules], { state });
    };
    const rarityOf = (h, name) => Object.values(h.state.domains.inventory.defs).find(item => item.name === name).rarity;
    const give = (h, name, rarity) => assert.equal(h.capture(line('+', 'item', name, { rarity }), ON).ok, true);
    // Without anything that earned it: epic, and one line says so.
    const plain = make([], null);
    give(plain, 'Sun Blade', 'legendary');
    give(plain, 'Moon Blade', 'epic');
    assert.deepEqual([rarityOf(plain, 'Sun Blade'), rarityOf(plain, 'Moon Blade')], ['epic', 'epic']);
    assert.equal(problems.length, 1, 'one Problems line, for the held one only');
    assert.match(problems[0].message, /Sun Blade was written legendary; the story's items reach epic here \(legendary needs a quest completed or a hard fight won in the same reply\)\./);
    // Earned: legendary stays.
    const won = make([earned], null);
    give(won, 'Sun Blade', 'legendary');
    assert.equal(rarityOf(won, 'Sun Blade'), 'legendary');
    assert.equal(problems.length, 1);
    // The pack's place is validated.
    const place = loot => ({ name: 'Mill Road', x: 1, y: 2, ...(loot === undefined ? {} : { loot }) });
    const check = loot => validatePack(pack({ content: { places: [place(loot)] } }));
    assert.equal(check({ maxRarity: 'rare' }).ok, true, JSON.stringify(check({ maxRarity: 'rare' }).errors));
    assert.deepEqual(check({ maxRarity: 'rare' }).pack.content.places[0].loot, { maxRarity: 'rare' });
    assert.equal(check(undefined).ok, true);
    for (const bad of [{ maxRarity: 'mythic' }, {}, { maxRarity: 'rare', extra: 1 }, 'rare']) assert.equal(check(bad).ok, false, JSON.stringify(bad));
});

test('a place\'s loot.maxRarity lowers the ceiling for the area, by name or alias; other places have none', async t => {
    const places = [
        { name: 'Mill Road', aliases: ['the road'], x: 1, y: 2, loot: { maxRarity: 'uncommon' } },
        { name: 'Vault', x: 3, y: 4 },
    ];
    const raw = pack({ content: { places } });
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true }, packs: [{ id: built.pack.id, version: built.pack.version, enabled: true, source: 'file', origin: 'test', pack: raw }] } });
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['~ place Mill Road']));
    const rarity = name => defNamed(host, name).rarity;
    await host.send('Loot.', reply('Gear.', ['+ item Sun Blade | rarity: epic', '+ item Plain Sword | rarity: common']));
    assert.deepEqual([rarity('Sun Blade'), rarity('Plain Sword')], ['uncommon', 'common'], 'the area\'s ceiling');
    assert.match(host.turn.problems().map(problem => problem.message).join(' '), /Sun Blade was written epic; the story's items reach uncommon here/);
    await host.send('Go.', reply('The vault.', ['~ place Vault']));
    await host.send('Loot.', reply('Gear.', ['+ item Moon Blade | rarity: epic']));
    assert.equal(rarity('Moon Blade'), 'epic', 'no loot field: no extra limit');
    await host.send('Back.', reply('Home.', ['~ place the road']));
    await host.send('Loot.', reply('Gear.', ['+ item Star Blade | rarity: rare']));
    assert.equal(rarity('Star Blade'), 'uncommon', 'found by alias');
});

// GR-P2a: the narrator's item words (kind, rarity, stats, equipped, wear, repair) in the static grammar, gear on only.

test('gear on: the item grammar names the gear words (one short line) and stays byte-identical reply to reply', async t => {
    const host = await fresh(t);
    const first = staticOf(host);
    const line = first.split('\n').find(text => text.startsWith('+ item Name'));
    assert.ok(line, 'the item grammar line');
    const added = line.slice(ITEM_LINE.length);
    assert.ok(added.length <= 300, `the gear words take ${added.length} characters`);
    for (const word of ['kind: weapon|armour|shield|head|cloak|feet|accessory|bag', 'rarity: common|uncommon|rare|epic|legendary', 'DEX: +1', 'at most 2', 'equipped: slot', 'wear: scuff|tear|ruin', 'repair: mend|restore']) assert.ok(added.includes(word), word);
    await host.send('Loot.', reply('Gear.', ['+ item Iron Sword | rarity: rare | equipped: weapon']));
    await host.send('Again.', reply('More.', ['+ item Rope']));
    assert.equal(staticOf(host), first, 'the same bytes after two more replies');
});

test('gear off (or the RPG off): the item grammar line is the old one, and the static bytes carry no gear word', async t => {
    for (const settings of [{}, { features: { 'story-block.gear': true } }]) {
        t.mock.method(console, 'warn', () => {});
        const host = await createHost({ modules: [], settings });
        t.after(() => host.close());
        await host.send('Hello.', 'The road.');
        const text = staticOf(host);
        assert.ok(text.split('\n').includes(ITEM_LINE), 'the old line, byte for byte');
        assert.doesNotMatch(text, /rarity:|equipped: slot|repair: mend|accessory\|bag/);
        const before = text;
        await host.send('Loot.', reply('Gear.', ['+ item Rope']));
        assert.equal(staticOf(host), before);
    }
});

test('a reply written with the grammar\'s words applies slot, rarity, stats, equipped, wear and repair', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('Gear.', ['+ item Plain Thing | kind: weapon | rarity: rare | DEX: +1 | AGI: +1 | equipped: weapon', '+ item Fur Mantle | kind: cloak | rarity: uncommon | AGI: +1 | equipped: cloak']));
    const blade = defNamed(host, 'Plain Thing');
    assert.deepEqual([blade.slot, blade.rarity], ['weapon', 'rare']);
    const gear = host.sdk.query('inventory.gear', { owner: 'party' });
    assert.deepEqual([gear.slots.weapon.name, gear.slots.cloak.name], ['Plain Thing', 'Fur Mantle']);
    assert.deepEqual(gear.statBonus, { STR: 0, VIT: 0, AGI: 2, DEX: 1, INT: 0, LUK: 0, CHA: 0 });
    await host.send('Fight.', reply('Torn.', ['~ item Plain Thing — struck | wear: ruin']));
    await host.send('Fight.', reply('Torn.', ['~ item Plain Thing — struck again | wear: ruin']));
    await host.send('Fight.', reply('Torn.', ['~ item Plain Thing — struck again | wear: ruin']));
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.broken, true, 'three ruins break it');
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus.DEX, 0, 'broken gives nothing');
    await host.send('Smith.', reply('Mended.', ['~ item Plain Thing — reforged | repair: restore']));
    const after = host.sdk.query('inventory.gear', { owner: 'party' });
    assert.equal(after.slots.weapon.broken, false);
    assert.equal(after.statBonus.DEX, 1, 'the stats are back');
});

test('a name\'s length never decides whether a piece can be equipped: 12 and 13+ letters, spaced or one word, equip alike', () => {
    for (const name of ['Iron Sword', 'Twelveletter Sword', 'Thirteenletter Sword', 'Oakheart Longbow of Bluewatch', 'Antidisestablishmentarian Sword']) {
        assert.equal(gearSlotOf(null, name), 'weapon', name);
    }
    assert.equal(gearSlotOf(null, 'Thirteenletters'), null, 'a name with no slot word has none, at any length');
});

test('a real compound gear word is read as a whole word (Longsword, Warhammer, Breastplate, Iron Gauntlet); look-alikes are goods', () => {
    const slots = { 'Longsword': 'weapon', 'Steel Longsword': 'weapon', 'Warhammer': 'weapon', 'Oakheart Longbow of Bluewatch': 'weapon', 'Breastplate': 'body', 'Chainmail': 'body', 'Steel Greatswords': 'weapon', 'Quarterstaff': 'weapon', 'Platemail': 'body', 'Iron Gauntlet': 'accessory', 'Leather Gauntlets': 'accessory' };
    for (const [name, slot] of Object.entries(slots)) assert.equal(gearSlotOf(null, name), slot, name);
    for (const name of ['Password', 'Rainbow Trout', 'Elbow Grease', 'Overwhelm Draught', 'Template', 'Email', 'Wardrobe Key', 'Spring Water', 'Escape Plan',
        'Lucky Horseshoe', 'Snowshoes', 'Overshoes', 'Reboot Manual', 'Wineboot', 'Windshield Wiper', 'Heatshield', 'Bookshield', 'Crossword Puzzle', 'Crosswords', 'Flagstaff', 'Mainstaff', 'Ironhelmet']) assert.equal(gearSlotOf(null, name), null, name);
});

test('story lines and the hand form: a long or compound name becomes equipment and the card\'s Equip puts it on', async t => {
    const host = await fresh(t);
    const names = ['Twelveletter Sword', 'Thirteenletter Sword', 'Longsword', 'Oakheart Longbow of Bluewatch', 'Iron Gauntlet'];
    await host.send('Loot.', reply('Gear.', names.map(name => `+ item ${name}`)));
    for (const name of names) {
        assert.equal(wear(host, name).kind, 'equipment', name);
        await equip(host, name);
        assert.ok(wear(host, name).equipped, name);
    }
    for (const name of ['Handmade Greatsword Bearing Name', 'Warhammer']) {
        const added = await host.sdk.command('inventory.add', { name, qty: 1, kind: 'equipment', owner: 'party' });
        assert.equal(added.ok, true, `${name}: ${added.message}`);
        await equip(host, name);
    }
});

test('carry table: every kind, plurals, vehicles named as items, unknown stays 20', () => {
    const kinds = { pony: 30, horse: 40, mule: 50, donkey: 50, 'pack animal': 50, 'pack horse': 50, cart: 60, barrow: 60, 'hand-cart': 60, sledge: 60,
        carriage: 80, coach: 80, boat: 100, barge: 150, wagon: 150, ox: 20, '': 20 };
    for (const [kind, value] of Object.entries(kinds)) assert.equal(kindCarry(kind), value, kind);
    const plurals = { ponies: 30, horses: 40, mules: 50, donkeys: 50, carts: 60, barrows: 60, 'hand-carts': 60, sledges: 60, carriages: 80, coaches: 80, boats: 100, barges: 150, wagons: 150 };
    for (const [kind, value] of Object.entries(plurals)) assert.equal(kindCarry(kind), value, kind);
    assert.deepEqual(['Carriage', 'Old Coach', 'Stage Coaches', 'Carriages', 'Grain Barge', 'Barges', 'Wagons', 'Sledges', 'Coachman\'s Whip', 'Rope'].map(itemCarryOf), [80, 80, 80, 80, 150, 150, 150, 60, null, null]);
});

test('a Re-read that adds an earlier `+ item` line of the same item keeps the later stack ids, so the reader\'s equip stays (itemIds mark)', async t => {
    const host = await fresh(t);
    await host.send('Loot.', reply('A find.', ['+ item Oak Dagger | rarity: uncommon']));
    await host.send('More.', reply('Another.', ['+ item Stone | qty: 3']));
    const dagger = wear(host, 'Oak Dagger').stack;
    await equip(host, 'Oak Dagger');
    const at = host.ctx.chat.findIndex(message => /A find/.test(message.mes));
    assert.ok(host.ctx.chat[at].mes.length > 0);
    host.ctx.chat[at].mes = reply('A find.', ['+ item Oak Dagger | rarity: common', '+ item Oak Dagger | rarity: uncommon']);
    const result = await host.turn.reread(at);
    assert.equal(result.ok, true, result.message);
    assert.equal(host.head().domains.inventory.stacks[dagger]?.equipped, 'weapon', 'the original stack keeps its id and stays worn');
    assert.equal(Object.values(host.head().domains.inventory.stacks).filter(item => host.head().domains.inventory.defs[item.def].name === 'Oak Dagger').length, 2);
    const again = await host.turn.reread(at);
    assert.equal(again.ok, true, again.message);
    assert.equal(host.head().domains.inventory.stacks[dagger]?.equipped, 'weapon');
});
