// Gear wear in a v1 fight (setup mark `gearWear: 1`): a decisive hit taken wears the body piece one step, a decisive miss the weapon; told to the narrator at its exchange; an unmarked setup wears nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { wearOfV1 } from '../../../../modules/rpg/board/v1-wear.js';
import { settledNoteV1 } from '../../../../modules/rpg/combat/note.js';
import { dice } from '../../../../core/interaction/dice.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { equip, reply } from '../../inventory/gear-inventory.helpers.js';

const set = (host, slug, fields) => host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields });
async function world(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        assert.equal((await host.sdk.command('dm.define', { definition: made })).ok, true);
    }
    await set(host, 'character', { who: 'Ren', level: 8, vit: 24 });
    await set(host, 'skills', { who: 'Ren' });
    await host.send('Foes.', reply('Rats.', ['+ dm foes — why | kind: set-slot-1 | name: Brutes | count: 4 | level: 6 | tier: standard']));
    await host.send('Gear.', reply('Kit.', ['+ item Traveling Robe | slot: body', '+ item Short Sword | slot: weapon']));
    await equip(host, 'Traveling Robe');
    await equip(host, 'Short Sword');
    return host;
}
const heroId = host => fightKind.actors(host.head())[0].id;
const steps = host => Array.from({ length: 4 }, () => ({ inputs: [{ actor: heroId(host), choice: 'normal', args: { target: '1.1' } }] }));
const wearCalls = out => out.changes.flatMap(change => (change.type === 'rpg.board.award' ? change.payload.wears ?? [] : []));

test('a marked fight wears the body piece on a decisive hit taken and the weapon on a decisive miss; an unmarked one wears nothing', async t => {
    const host = await world(t), marked = fightKind.open(host.head(), { anchor: 'a', seed: 1, args: { rules: {} } }).setup;
    assert.equal(marked.gearWear, 1);
    const old = { ...marked }; delete old.gearWear;
    let body = null, weapon = null;
    for (let seed = 1; seed < 400 && !(body && weapon); seed += 1) {
        const out = fightKind.settle(host.head(), marked, steps(host), dice(seed, 0));
        body ||= out.result.wear?.find(event => event.item === 'Traveling Robe') && { seed, out };
        weapon ||= out.result.wear?.find(event => event.item === 'Short Sword') && { seed, out };
    }
    assert.ok(body, 'a decisive hit taken wore the robe');
    assert.ok(weapon, 'a decisive miss wore the sword');
    assert.deepEqual(wearCalls(body.out).map(call => call.slot).includes('defence'), true);
    assert.deepEqual(wearCalls(weapon.out).map(call => call.slot).includes('weapon'), true);
    const event = body.out.result.wear.find(one => one.item === 'Traveling Robe');
    assert.equal(event.who, 'Ren');
    assert.notEqual(event.from, event.to);
    assert.match(settledNoteV1(body.out.result), new RegExp(`Ren's Traveling Robe: ${event.from} → ${event.to}`));
    const again = fightKind.settle(host.head(), old, steps(host), dice(body.seed, 0));
    assert.equal(again.result.wear, undefined, 'a setup made before the mark wears nothing');
    assert.equal(wearCalls(again).length, 0);
    assert.deepEqual(fightKind.settle(host.head(), marked, steps(host), dice(body.seed, 0)).changes, body.out.changes, 'the same input settles the same');
});

test('a broken piece or no piece wears nothing; pieces step down in turn; an area blow counts once', () => {
    const record = { party: [{ id: 'k', label: 'Ren' }], lines: [['exchange', 1],
        ['foe-attack', 'Rat', 'Ren', 20, 22, 1, 3, 'decisive', 0, 5, 10], ['foe-attack', 'Rat', 'Ren', 20, 22, 1, 3, 'decisive', 0, 5, 5],
        ['attack', 'Ren', 'area', 'Rat 1', 1, 3, null, null, 'miss-nat1', 0, 9], ['attack', 'Ren', 'area', 'Rat 2', 1, 3, null, null, 'miss-nat1', 0, 9]] };
    const slots = { body: { name: 'Robe', cond: 100 }, weapon: { name: 'Sword', cond: 100 } };
    const worn = wearOfV1(record, { modules: { k: 'pack.chat/character' }, slotsOf: () => slots });
    assert.equal(worn.events.length, 3, 'two hits and one area miss');
    assert.notEqual(worn.events[0].to, worn.events[1].from === worn.events[0].to ? null : worn.events[1].from);
    assert.equal(wearOfV1(record, { modules: { k: 'pack.chat/character' }, slotsOf: () => ({ body: { name: 'Robe', cond: 0, broken: true } }) }).events.length, 0);
    assert.equal(wearOfV1(record, { modules: { k: 'pack.chat/character' }, slotsOf: () => ({}) }).events.length, 0);
});
