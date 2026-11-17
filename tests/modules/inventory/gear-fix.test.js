// Gear, final review fixes (Story Block 2.18.0): R1 a change before a roll changes its gear (the payload keeps only the mark), R2 `gear.wear { recorded }` only from
// the RPG's own nested call, R3 a join's signature gear never fails the join, R4 a first name or alias counts only when it means one Character, R5 `packs.castGear`
// asks the same question.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { createFakeModel } from '../../../testkit/model.js';
import { validatePack } from '../../../packs/validate.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';
import { gearMatches, planGear, sameWho } from '../../../modules/rpg/gear.js';
import { actorIdOf } from '../../../modules/rpg/roster.js';
import { readSheet } from '../../../modules/rpg/index.js';
import { hashJson } from '../../../core/replay.js';
import { createHarness } from './helpers/fake-ctx.js';
import { core, stocked } from './fixtures.js';
import { reply, success } from '../data-modules/helpers.js';
import { pack } from '../../packs/helpers/fixtures.js';
import { character, sheetDomain } from '../rpg/helpers.js';
import { seedCrypto } from '../../suite/qa/helpers/seeded.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const sheetOf = b => readSheet({ domains: { dataModules: sheetDomain(b) } });

// ---- R1: a change before a roll changes its gear ------------------------------------------------------------------------------------------

const PLAN_TEXT = 'pace: all\nact Astra | target: Mud Crawlers\nfoe Mud Crawlers | target: Astra | defend: AGI';
const SET = '+ dm foes — why | kind: set-slot-1 | name: Mud Crawlers | count: 6 | level: 60';
const GEAR_LINES = ['+ item Cane Sword | kind: weapon | rarity: rare | DEX: +2 | equipped: weapon', '+ item Jerkin | kind: armour | rarity: uncommon | VIT: +1 | equipped: body'];
const resultAt = (host, index) => host.ctx.chat[index].extra?.storySuite?.receipts?.find(entry => entry.type === 'rpg.resolve')?.data?.v2?.result;
const payloadAt = (host, index) => host.ctx.chat[index].extra?.storySuite?.receipts?.find(entry => entry.type === 'rpg.resolve')?.replan?.payload;
const stable = host => JSON.stringify(host.head());

async function fightWorld(t, { gear = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    // (Standard dice follow the record ids: a fixed seed keeps the fights, and so these tests, the same on every run.)
    const restore = seedCrypto(11);
    t.after(restore);
    const model = createFakeModel(Array(60).fill(PLAN_TEXT));
    let host = null;
    host = await createHost({ callModel: model, settings: { features: gear ? { 'story-block.gear': true } : {} } });
    t.after(() => host.close());
    host.features.set('story-block.rpg', true);
    await host.send('Begin.', 'Opening.');
    for (const name of ['Character', 'Foes']) success(await host.sdk.command('dm.define', { definition: structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition) }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', level: 5 } }));
    await host.send('Set.', reply(SET));
    await host.send('Gear up.', reply(...GEAR_LINES));
    const gearAt = host.ctx.chat.length - 1;
    await host.send('I strike.', 'The fight.');
    await host.send('I strike again.', 'The fight goes on.');
    return { host, gearAt };
}
async function agrees(host) {
    const live = stable(host);
    host.store.rebuild();
    assert.equal(stable(host), live, 'a rebuild gives the live story');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(stable(host), live, 'a reload gives the live story');
    assert.deepEqual(host.store.problems(), []);
}

test('R1: the guard asks the state before the roll for the pieces and the load: an empty bag matches a record of no gear; pieces gone or pieces not in the record do not', () => {
    const inventory = (extra = {}) => ({
        defs: { 'story/cane-sword': { id: 'story/cane-sword', name: 'Cane Sword', kind: 'equipment', slot: 'weapon', rarity: 'rare', stack: false, stats: { DEX: 2 } } },
        stacks: { it_1: { id: 'it_1', def: 'story/cane-sword', qty: 1, owner: 'party', equipped: 'weapon', note: '', from: '' }, ...extra },
    });
    const state = inv => ({ domains: { inventory: inv, dataModules: sheetDomain({}) } });
    const bare = { v: 1, who: { astra: { own: ['party'] } } };
    assert.equal(gearMatches(state({ defs: {}, stacks: {} }), bare, hashJson), true, 'a record of no gear matches an empty bag');
    assert.equal(gearMatches(state({ defs: {}, stacks: {} }), { v: 1, who: { astra: { own: ['party'], add: { dex: 2 }, items: [{ name: 'Cane Sword', stats: { dex: 2 } }] } } }, hashJson), false, 'the pieces are gone');
    assert.equal(gearMatches(state(inventory()), bare, hashJson), false, 'pieces worn that the record does not have');
    const record = { v: 1, who: { astra: { own: ['party'], add: { dex: 2 }, items: [{ name: 'Cane Sword', stats: { dex: 2 } }] } } };
    assert.equal(gearMatches(state(inventory()), record, hashJson), true, 'the same pieces');
    assert.equal(gearMatches(state(inventory({ it_2: { id: 'it_2', def: 'story/cane-sword', qty: 1, owner: 'party', equipped: 'weapon', note: '', from: '' } })), record, hashJson), true, 'the first worn piece of a slot is the one that counts');
    assert.equal(gearMatches(state(inventory()), { ...record, who: { astra: { ...record.who.astra, add: { dex: 3 } } } }, hashJson), false, 'a different bonus');
});

// ---- R2: `recorded` only from the RPG's own call ----------------------------------------------------------------------------------------------

test('R2: gear.wear { recorded: true } is refused for an event step and a top-level call, gear off or on; the RPG\'s own nested call may', () => {
    const OFF = { feature: () => false };
    const ON = { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' };
    const make = () => {
        const module = core();
        const state = stocked(module);
        state.domains.inventory.defs['pack.fantasy/iron-sword'].slot = 'weapon';
        state.domains.inventory.stacks.it_sword001.equipped = 'weapon';
        return createHarness([module], { state });
    };
    for (const extra of [OFF, ON]) {
        const h = make();
        for (const caller of ['event:ambush', null, 'dm']) {
            const rec = h.run('gear.wear', { owner: 'party', slot: 'weapon', steps: 3, recorded: true }, { cause: 'system', caller, extra });
            assert.equal(rec.ok, false, `caller ${caller}`);
            assert.equal(rec.code, 'REFUSED');
        }
        const ui = h.run('gear.wear', { owner: 'party', slot: 'weapon', steps: 1, recorded: true }, { cause: 'ui', caller: 'story-block', extra });
        assert.equal(ui.ok, false, 'not by a button');
    }
    // with gear off a pack event's plain gear.wear is refused as it was
    const off = make().run('gear.wear', { owner: 'party', slot: 'weapon', steps: 1 }, { cause: 'system', caller: 'event:ambush', extra: OFF });
    assert.equal(off.code, 'REFUSED');
    // the RPG's own call wears by its record even with the switch off
    const own = make().run('gear.wear', { owner: 'party', slot: 'weapon', steps: 1, recorded: true }, { cause: 'system', caller: 'story-block', extra: OFF });
    assert.equal(own.ok, true, JSON.stringify(own));
    // and an event's plain call wears with gear on
    assert.equal(make().run('gear.wear', { owner: 'party', slot: 'weapon', steps: 1 }, { cause: 'system', caller: 'event:ambush', extra: ON }).ok, true);
});

// ---- R3: a join with signature gear never fails ----------------------------------------------------------------------------------------------

const ITEMS = [
    { name: 'Cane Sword', kind: 'equipment', slot: 'weapon', rarity: 'uncommon' },
    { name: 'Oak Buckler', kind: 'equipment', slot: 'shield', rarity: 'common' },
];
const person = (extra = {}) => ({ id: 'mara', name: 'Mara', aliases: [], about: 'Runs the night ferry.', look: 'Wiry.', start: { place: 'Docks', goal: 'Keep the ferry running.' }, ...extra });
// (a party module that lists Mara and Tam as actors: their pieces are theirs; without it they are the shared bag's)
const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_tam00001', name: 'Tam' }] } };
async function joinWorld(t, { list = [person({ gear: ['Cane Sword', 'Oak Buckler'] })], enabled = true, actors = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    const raw = pack({ content: { items: ITEMS, cast: list } });
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    const host = await createHost({
        modules: actors === 'other' ? [{ id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_wessel01', name: 'Wessel' }] } }] : actors ? [ACTORS] : [],
        settings: { features: { 'story-block.gear': true, 'story-block.rpg': true }, modules: { 'story-block': { rpgJoin: 'auto', rpgFormula: 'classic' } },
            packs: [{ id: built.pack.id, version: built.pack.version, enabled, source: 'file', origin: 'test', pack: raw }] },
    });
    t.after(() => host.close());
    host.packId = built.pack.id;
    await host.send('Begin.', 'Opening.');
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}
const rows = host => host.sdk.query('inventory.items');
const joined = host => host.ctx.chat.at(-1).extra.storySuite.receipts.find(entry => entry.type === 'capture.party');

test('R3: a story item with the same name does not stand in the way: the pack\'s piece is granted by its definition ID and worn', { skip }, async t => {
    // (the story made its own Cane Sword before the pack was switched on: two defs will share the name)
    const host = await joinWorld(t, { enabled: false });
    await host.send('A blade.', reply('+ item Cane Sword | kind: weapon'));
    assert.deepEqual(rows(host).map(row => [row.name, row.def]), [['Cane Sword', 'story/cane-sword']]);
    assert.equal(await host.packs.packs.setEnabled(host.packId, true), true);
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.equal(joined(host)?.summary, 'Mara joined the party. Gear: Cane Sword, Oak Buckler.', 'the join stands');
    const mine = rows(host).filter(row => row.def.startsWith('pack.mini/'));
    assert.deepEqual(mine.map(row => [row.def, row.equipped]).sort(), [['pack.mini/cane-sword', 'weapon'], ['pack.mini/oak-buckler', 'off-hand']]);
    assert.equal(rows(host).find(row => row.def === 'story/cane-sword').equipped ?? null, null, 'the story\'s own sword is left alone');
});

test('R3: a duplicate name (two defs called Cane Sword already) is no longer ambiguous for the next person', { skip }, async t => {
    const host = await joinWorld(t, { enabled: false, list: [person({ gear: ['Cane Sword'] }), person({ id: 'tam', name: 'Tam', gear: ['Cane Sword'] })] });
    await host.send('A blade.', reply('+ item Cane Sword | kind: weapon'));
    assert.equal(await host.packs.packs.setEnabled(host.packId, true), true);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Tam too.', reply('+ party Tam'));
    assert.equal(joined(host)?.summary.startsWith('Tam joined the party.'), true, 'the join stands');
    assert.deepEqual(rows(host).filter(row => row.def === 'pack.mini/cane-sword').map(row => [row.owner, row.equipped]).sort(), [['ac_mara0001', 'weapon'], ['ac_tam00001', 'weapon']], 'each has the pack\'s own sword, by its ID');
    assert.deepEqual(host.store.problems(), []);
});

test('R3: a taken slot does not fail the join: the piece is carried, not worn, and a Problems line says so', { skip }, async t => {
    const host = await joinWorld(t);
    await host.send('An old blade.', reply('+ item Old Blade | kind: weapon | equipped: weapon'));
    const blade = rows(host).find(row => row.name === 'Old Blade');
    assert.equal((await host.sdk.command('inventory.transfer', { stack: blade.stack, to: 'ac_mara0001' })).ok, true);
    assert.equal((await host.sdk.command('item.equip', { stack: blade.stack, owner: 'ac_mara0001', slot: 'weapon' })).ok, true);
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.equal(joined(host)?.summary.startsWith('Mara joined the party.'), true, 'the join stands');
    const sword = rows(host).find(row => row.def === 'pack.mini/cane-sword');
    assert.equal(sword.equipped ?? null, null, 'carried');
    assert.equal(rows(host).find(row => row.def === 'pack.mini/oak-buckler').equipped, 'off-hand', 'the free slot is filled');
    assert.equal(rows(host).find(row => row.name === 'Old Blade').equipped, 'weapon', 'what was worn stays');
    assert.ok(host.turn.problems().some(problem => /Cane Sword is carried, not worn/.test(JSON.stringify(problem))), JSON.stringify(host.turn.problems()));
});

// ---- R4 / R5: a first name or alias means one Character -------------------------------------------------------------------------------------

test('R5: packs.castGear counts "already in the party" the way sameWho does: by first name when one Character is meant, not when two are', { skip }, async t => {
    const host = await joinWorld(t, { list: [person({ aliases: ['the ferrywoman'], gear: ['Cane Sword'] })] });
    const define = async (slug, name) => {
        const definition = structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === 'character').definition);
        definition.slug = slug; definition.name = name; definition.state.who.default = name;
        assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    };
    assert.ok(host.sdk.query('packs.castGear', { name: 'Mara' }), 'not in the party: the line');
    await define('mara-quill', 'Mara Quill');
    assert.equal(host.sdk.query('packs.castGear', { name: 'Mara' }), null, 'Mara is Mara Quill: in the party');
    await define('mara-holt', 'Mara Holt');
    assert.ok(host.sdk.query('packs.castGear', { name: 'Mara' }), 'two Maras: not guessed, the line stands');
});

// ---- a join with no party roster, and the kind word of an item line --------------------------------------------------------------------------

// (pinned change, 2.18.1: the RPG answers the roster itself, so "no party module" now means a roster of another make that does not list the joiner)
test('a roster that does not list the joiner: nothing is given to the party bag (its worn gear is the reader\'s), the join stands, and one Problems line says it stays with them', { skip }, async t => {
    const host = await joinWorld(t, { actors: 'other' });
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.deepEqual(rows(host), []);
    assert.equal(joined(host)?.summary, 'Mara joined the party.');
    assert.equal('gear' in joined(host).data, false);
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus, { STR: 0, VIT: 0, AGI: 0, DEX: 0, INT: 0, LUK: 0, CHA: 0 }, 'the reader gains nothing');
    assert.equal(host.turn.problems().filter(problem => /Mara's gear stays with Mara \(no party roster\)/.test(JSON.stringify(problem))).length, 1);
    host.store.rebuild();
    assert.deepEqual(rows(host), []);
});

test('with gear on an item line\'s kind word names the inventory kind (gear off: goods, as 2.17.0): consumable (potion, draught, food), material, quest; a plain item stays goods', { skip }, async t => {
    for (const gear of [false, true]) {
        const host = await createHost({ settings: { features: gear ? { 'story-block.gear': true, 'story-block.rpg': true } : {} } });
        t.after(() => host.close());
        await host.send('Begin.', 'Opening.');
        await host.send('Loot.', reply('+ item Healing Draught | kind: consumable', '+ item Red Potion | kind: potion', '+ item Pine Resin | kind: material', '+ item Brass Key | kind: quest', '+ item Odd Stone'));
        const kind = name => host.sdk.query('inventory.definitions').find(def => def.name === name).kind;
        assert.deepEqual(['Healing Draught', 'Red Potion', 'Pine Resin', 'Brass Key', 'Odd Stone'].map(kind), gear ? ['consumable', 'consumable', 'material', 'quest', 'goods'] : Array(5).fill('goods'), `gear ${gear}: off builds the def as 2.17.0 did`);
        host.store.rebuild();
        assert.deepEqual(host.sdk.query('inventory.definitions').find(def => def.name === 'Healing Draught').kind, gear ? 'consumable' : 'goods');
    }
});
