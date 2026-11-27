// The roster in the party's load: every member it names has room of their own from the start, a Character block is counted once, the main character is not a
// person, owner `party` is the Bag bar's numbers, and a gear record made before that rule (no `rule` mark) is still judged by the shared bag alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carryPicture, createGearQueries, gearAnswer } from '../../../modules/inventory/gear.js';
import { holderName } from '../../../modules/inventory/validate.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../modules/inventory/index.js';
import { gearMatches, gearValid, planGear } from '../../../modules/rpg/gear.js';
import { actorIdOf, rosterQueries } from '../../../modules/rpg/roster.js';
import { readSheet } from '../../../modules/rpg/index.js';
import { hashJson } from '../../../core/replay.js';
import { character, sheetDomain } from '../rpg/helpers.js';
import { def, stack } from './fixtures.js';

const WESSEL = actorIdOf('pack.chat/wessel'), REN = actorIdOf('pack.chat/ren'), MARA = 'ac_mara0001';
const hero = (who, str) => ({ role: 'character', fields: character(who, { str, 'hp-max': 10, wis: 10 }) });
const BOTH = { wessel: hero('Wessel', 14), ren: hero('Ren', 8) };

/** `loads`: { owner: how many units of weight 1 it holds }. */
function stateOf(blocks, loads = {}, actors = null) {
    const stacks = Object.fromEntries(Object.entries(loads).map(([owner, qty], n) => [`it_rope000${n}`, stack(`it_rope000${n}`, 'story/rope', qty, { owner })]));
    return {
        domains: {
            dataModules: sheetDomain(blocks), inventory: { defs: { 'story/rope': def('story/rope', 'Rope', { kind: 'goods', stack: true, weight: 1 }) }, stacks },
            ...(actors ? { party: { actors } } : {}),
        },
    };
}

/** The live queries: gear's own over the state, with the RPG's roster answering for the reader `persona`. */
function live(state, persona = 'Wessel') {
    const queries = {
        ...rosterQueries({ persona: () => persona }),
        ...createGearQueries({ on: () => true, condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, names: (_state, tools, id) => tools.query('party.actors')?.find(actor => actor.id === id)?.name ?? '', owners: () => [] }),
    };
    const tools = { query: (name, args = {}) => queries[name]?.(state, args, tools) ?? null };
    return tools.query;
}
const before = state => carryPicture(state, { carryOf: defCarry, legacy: true });

test('every Character block on the roster is counted once, from the start: the total is what it was, and a first hand-over is held to the companion\'s own limit', () => {
    const state = stateOf(BOTH, { party: 1 });
    const query = live(state);
    const rule = query('gear.carry');
    assert.equal(rule.capacity, before(state).capacity);
    assert.deepEqual(rule.people, [{ id: REN, name: 'Ren', load: 0, capacity: 26 }]);
    assert.match(query('gear.carry', { owner: REN, add: [{ qty: 27 }], move: true }).message, /^Ren cannot carry that: 0 of 26 carried/);
    const carry = query('gear.view').carry;
    assert.deepEqual([carry.breakdown, carry.capacity, carry.people], ['Wessel carries 38 · Ren carries 26', 64, []]);
});

test('a companion block who holds something is not counted twice, with or without a main character', () => {
    const state = stateOf(BOTH, { [REN]: 1 });
    assert.equal(before(state).capacity, 38 + 26 + 30, 'before: their strength in the shared bag and a second room at the default');
    for (const persona of ['Wessel', 'Nobody']) {
        const carry = live(state, persona)('gear.view').carry;
        assert.deepEqual([carry.breakdown, carry.capacity], ['Wessel carries 38 · Ren carries 26', 64], persona);
        assert.deepEqual(carry.people, [{ id: REN, name: 'Ren', load: 1, capacity: 26, level: 'normal' }], persona);
    }
    assert.equal(carryPicture(state, { carryOf: defCarry }).capacity, 64, 'from the state alone too');
});

test('with no main character known a block that holds nothing stays in the shared bag; the main character is never a person', () => {
    const state = stateOf(BOTH);
    assert.deepEqual(live(state, 'Nobody')('gear.carry').people, []);
    assert.deepEqual(live(state, 'Ren')('gear.carry').people.map(person => person.id), [WESSEL]);
    // Things filed under the main character's own id make a room of theirs; their block is still counted once, the same from the state alone.
    const own = stateOf(BOTH, { [REN]: 26 });
    assert.deepEqual([live(own, 'Ren')('gear.carry').capacity, carryPicture(own, { carryOf: defCarry }).capacity], [64, 64]);
    const named = stateOf({}, {}, { [MARA]: { name: 'Mara' } });
    const roster = { members: [{ id: MARA, name: 'Mara' }], pc: MARA };
    assert.deepEqual(carryPicture(named, { carryOf: defCarry, roster }).people, []);
});

test('the reader\'s own chip is named only while members are listed', () => {
    assert.equal(live(stateOf({ wessel: hero('Wessel', 14) }))('gear.view').carry.breakdown, 'Carries 38');
});

test('owner party is the Bag bar\'s numbers: encumbered exactly when the bar is over', () => {
    for (const [loads, over] of [[{ party: 40, [MARA]: 5 }, false], [{ party: 40, [MARA]: 28 }, true], [{ party: 1, [MARA]: 31 }, false]]) {
        const query = live(stateOf({ wessel: hero('Wessel', 14) }, loads, { [MARA]: { name: 'Mara' } }));
        const answer = query('inventory.gear', { owner: 'party' }).carry, bar = query('gear.view').carry;
        assert.deepEqual([answer.load, answer.capacity, answer.encumbered], [bar.load, bar.capacity, bar.level === 'over'], JSON.stringify(loads));
        assert.equal(answer.encumbered, over);
        assert.equal(answer.sources.reduce((sum, entry) => sum + entry.carry, 0), answer.capacity);
    }
});

// The shared bag alone is over (40 of Wessel's 38) while the party is not (45 of 68): the two rules differ.
const DIFFER = () => stateOf({ wessel: hero('Wessel', 14) }, { party: 40, [MARA]: 5 }, { [MARA]: { name: 'Mara' } });
// As the code before the mark wrote it.
const OLD = { v: 1, who: { wessel: { own: [WESSEL, 'party'], enc: -2 } } };

test('replay: a gear record without the rule mark is judged by the shared bag alone, a new one by the party\'s numbers', () => {
    const state = DIFFER();
    assert.equal(gearValid(OLD), true);
    assert.equal(gearMatches(state, OLD, hashJson), true, 'the old record still matches');
    assert.equal(gearMatches(state, { ...OLD, rule: 2 }, hashJson), false, 'by the new rule it would not');
    const made = planGear(readSheet(state), live(state), 'Wessel');
    assert.deepEqual(made, { v: 1, rule: 2, who: { wessel: { own: [WESSEL, 'party'] } } });
    assert.equal(gearValid(made), true);
    assert.equal(gearMatches(state, made, hashJson), true);
    assert.equal(gearMatches(state, { v: 1, who: made.who }, hashJson), false, 'without its mark it would be judged by the old rule');
    assert.equal(gearValid({ ...OLD, rule: 3 }), false);
});

test('replay: an old record of a companion block keeps their default-strength limit; a new one has the block\'s', () => {
    const state = stateOf(BOTH, { [REN]: 28 });
    const old = { v: 1, who: { ren: { own: [REN] } } };
    assert.equal(gearMatches(state, old, hashJson), true, '28 of the default 30');
    assert.equal(gearAnswer(state, { owner: REN }, { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, mounts: [] }).carry.encumbered, true, '28 of their own 26');
    assert.equal(gearMatches(state, { ...old, rule: 2 }, hashJson), false);
    const made = planGear(readSheet(state), live(state), 'Wessel');
    assert.equal(made.who.ren.enc, -2);
    assert.equal(gearMatches(state, made, hashJson), true);
});

test('a holder the roster no longer lists adds no room and keeps their load; read from the state alone, or the old way, nobody has left', () => {
    const state = stateOf({ wessel: hero('Wessel', 14), ren: { role: 'character', fields: { ...hero('Ren', 8).fields, left: true } } }, { party: 1, [REN]: 5 });
    const roster = { members: [{ id: WESSEL, name: 'Wessel' }], pc: WESSEL };
    const picture = carryPicture(state, { carryOf: defCarry, roster, nameOf: () => 'Ren' });
    assert.deepEqual([picture.load, picture.capacity, picture.people, picture.left], [6, 38, [], [{ id: REN, name: 'Ren', load: 5 }]]);
    for (const other of [carryPicture(state, { carryOf: defCarry }), before(state)]) assert.deepEqual([other.left, other.people.map(person => person.id)], [[], [REN]]);
});

test('a name for someone who left: the party domain, a member list that keeps them, else "Someone who left" ("A party member" with no party module answering), never the id', () => {
    const lists = { 'party.actors': [], 'party.levels': [{ id: REN, name: 'Ren', left: true }], 'party.names': [{ id: MARA, name: 'Mara' }] };
    const query = name => lists[name] ?? null;
    assert.deepEqual([holderName(query, null, REN), holderName(query, null, MARA), holderName(query, null, WESSEL), holderName(query, { actors: { [WESSEL]: { name: 'Wes' } } }, WESSEL), holderName(() => { throw new Error('no query'); }, null, MARA)],
        ['Ren', 'Mara', 'Someone who left', 'Wes', 'A party member']);
});
