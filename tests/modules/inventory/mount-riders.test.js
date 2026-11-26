// A mount whose `where` names the reader's character or a party member travels with the party: in the bag, on the Mount slot, in the carry
// limit for new replies; a Re-read of a reply captured before that keeps the old judgement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../core/replay.js';
import { selectBag } from '../../../ui/select/bag.js';
import { ridersOf } from '../../../modules/scene/mounts-parts/riders.js';
import { gearMatches, planGear } from '../../../modules/rpg/gear.js';
import { readSheet } from '../../../modules/rpg/read.js';
import { createGearQueries, travelsWith } from '../../../modules/inventory/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../modules/inventory/index.js';
import { rosterQueries } from '../../../modules/rpg/roster.js';
import { CORE_KINDS } from '../../../modules/scene/domains/index.js';
import { character, sheetDomain } from '../rpg/helpers.js';
import { def, stack } from './fixtures.js';
import { newHost, reply } from '../../../examples/text-rpg/tests/helpers/host.js';

const CREW = ['Rav', 'Torka', 'Rika', 'Vessa', 'Sister Temiwa'];
const PLACE = 'Sealcrown Courier Stables';

test('with the party by a rider\'s name: full or first name, whole words; a stranger is not; places and the old words still work', () => {
    for (const where of ['Rav, Torka, Rika, Vessa, Sister Temiwa', 'one ridden by Rav, one led by Torka', 'beside Temiwa on the wharf', 'Rav\'s', 'TORKA']) {
        assert.equal(travelsWith(where, 'Mill Road', CREW), true, where);
    }
    for (const where of ['Corporal Stenn', 'stabled at the Ravenna Arms', 'the Sisters yard', 'penned at the corral']) assert.equal(travelsWith(where, 'Mill Road', CREW), false, where);
    assert.equal(travelsWith('stabled at Mill Road', 'Mill Road', CREW), true, 'the place still works');
    assert.equal(travelsWith('', 'Mill Road', CREW), true);
    assert.equal(travelsWith('led by a boy', 'Mill Road', CREW), true);
    assert.equal(travelsWith('Rav, Torka', 'Mill Road'), false, 'without names it reads as before');
    assert.equal(travelsWith('stabled at the Ætna yard', 'Mill Road', ['Æ']), false);
});

test('riders: "ridden by" as written; a bare list of names gives the members in it, each as the party calls them', () => {
    assert.deepEqual(ridersOf('Rav, Torka, Rika, Vessa, Sister Temiwa', CREW), CREW);
    assert.deepEqual(ridersOf('Torka and Temiwa', CREW), ['Torka', 'Sister Temiwa']);
    assert.deepEqual(ridersOf('Torka & Torka', CREW), ['Torka']);
    assert.deepEqual(ridersOf('Torka, Corporal Stenn', CREW), ['Torka']);
    const noVessa = CREW.filter(name => name !== 'Vessa');
    assert.deepEqual(ridersOf('Rav, Torka, Rika, Vessa, Sister Temiwa', noVessa), noVessa);
    assert.equal(travelsWith('Rav, Torka, Rika, Vessa, Sister Temiwa', 'Mill Road', noVessa), true);
    assert.deepEqual(ridersOf('Corporal Stenn, Vessa', noVessa), [], 'no member named');
    assert.equal(travelsWith('Corporal Stenn, Vessa', 'Mill Road', noVessa), false);
    for (const where of ['stabled at the inn, Torka', 'Torka, penned', 'one ridden by Rav, one led by Torka']) assert.deepEqual(ridersOf(where, CREW), [], `no bare list: ${where}`);
    assert.deepEqual(ridersOf('Rav, Torka'), [], 'without names a bare list names nobody');
    assert.deepEqual(ridersOf('ridden by Wessel and Tam', CREW), ['Wessel', 'Tam']);
    assert.deepEqual(ridersOf('with the party', CREW), []);
    assert.deepEqual(ridersOf('', CREW), []);
});

const FEATURES = { 'story-block.gear': true, 'story-block.encumbrance': false };
const bagOf = host => {
    const view = host.sdk.query('gear.view', {});
    return selectBag({ rpg: true, items: host.sdk.query('inventory.items'), gear: view, mounts: host.sdk.query('mounts.list'), carriers: view.carriers });
};
const rocks = host => host.sdk.query('inventory.items').filter(item => item.name === 'Rock').reduce((sum, item) => sum + item.qty, 0);

test('a party member\'s herd is with the party in the bag and on the Mount slot, and adds room; replay == live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost(FEATURES);
    t.after(() => host.close());
    await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul', '~ place Sealcrown', '+ mount Bay Geldings | kind: horse | count: 2 | where: Torka', '+ mount Old Grey | kind: horse | where: Corporal Stenn']));
    const view = host.sdk.query('gear.view', {});
    assert.deepEqual(view.carriers.mounts.map(row => [row.name, row.withParty, row.riders]), [['Bay Geldings', true, ['Torka']], ['Old Grey', false, []]]);
    assert.deepEqual(view.carriers.rides.map(row => [row.name, row.withParty, row.riders]), [['Bay Geldings', true, ['Torka']], ['Old Grey', false, []]]);
    assert.deepEqual(bagOf(host).assets.transport.map(row => [row.withParty, row.riders]), [[true, ['Torka']], [false, []]]);
    const herd = view.carry.parts.find(part => part.label === 'Bay Geldings');
    assert.ok(herd && !herd.dim && herd.value > 0, 'the herd adds room');
    // The Mount slot: Torka rides it already; another member can join (two animals).
    assert.match((await host.sdk.command('mounts.ride', { who: 'Torka', mount: 'Bay Geldings' })).message, /already/i);
    const before = JSON.stringify(host.sdk.query('gear.view', {}));
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('gear.view', {})), before, 'rebuild == live');
});

test('the carry limit: a new reply counts the riders\' mount; a Re-read of a reply without the mark judges it as before', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost(FEATURES);
    t.after(() => host.close());
    await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul', '~ place Sealcrown', '+ mount Bay Gelding | kind: horse | where: Torka']));
    const limit = host.sdk.query('gear.carry', {}).capacity;
    const without = host.sdk.query('gear.carry', { riders: false }).capacity;
    assert.ok(limit > without, 'the horse adds room once its rider counts');
    await host.send('Stones.', reply('Stones.', [`+ item Stone | qty: ${without}`]));
    await host.send('More.', 'A quiet find.');
    const at = host.ctx.chat.length - 1;
    const marks = () => host.ctx.chat[at].extra.storySuite.rules;
    assert.ok(marks().includes('mountRiders'), 'a new reply is marked');
    host.ctx.chat[at].mes = reply('A quiet find.', ['+ item Rock | qty: 2']);
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(rocks(host), 2, 'marked: the horse\'s room counts');
    host.ctx.chat[at].mes = 'A quiet find.';
    assert.equal((await host.sdk.reread(at)).ok, true);
    host.ctx.chat[at].extra.storySuite.rules = marks().filter(name => name !== 'mountRiders');
    assert.ok(marks().includes('carryRoster'), 'the roster count stays');
    host.ctx.chat[at].mes = reply('A quiet find.', ['+ item Rock | qty: 2']);
    await host.sdk.reread(at);
    assert.equal(rocks(host), 0, 'unmarked: refused, as it was before');
    assert.ok(host.turn.problems().some(problem => /cannot carry that/.test(problem.message)), JSON.stringify(host.turn.problems()));
});

test('the roll guard takes a record made with a rider\'s mount counted, and still takes one made before riders counted', () => {
    const state = { domains: {
        dataModules: sheetDomain({ wessel: { role: 'character', fields: character('Wessel', { str: 14, 'hp-max': 10, wis: 10 }) } }),
        inventory: { defs: { 'story/rope': def('story/rope', 'Rope', { kind: 'goods', stack: true, weight: 1 }) }, stacks: { it_rope0001: stack('it_rope0001', 'story/rope', 40, { owner: 'party' }) } },
        scene: { place: { name: 'Mill Road' }, mounts: { 'm:grey': { name: 'Grey Mare', kind: 'horse', count: 1, pace: 35, condition: '', where: 'Wessel' } } },
    } };
    const queries = {
        ...rosterQueries({ persona: () => 'Wessel' }),
        ...createGearQueries({ on: () => true, condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, names: () => '', owners: () => [] }),
        'mounts.list': () => Object.values(state.domains.scene.mounts),
    };
    const tools = { query: (name, args = {}) => queries[name]?.(state, args, tools) ?? null };
    const made = planGear(readSheet(state), tools.query, 'Wessel');
    assert.equal(made.who.wessel.enc, undefined, '40 is under 38 plus the horse');
    assert.equal(gearMatches(state, made, hashJson), true);
    const owner = made.who.wessel.own;
    assert.equal(gearMatches(state, { v: 1, rule: 2, who: { wessel: { own: owner, enc: -2 } } }, hashJson), true, 'made while the horse did not count');
});

test('the grammar asks for one line per animal or vehicle, count only for a string never split', () => {
    const { grammar } = CORE_KINDS.mount;
    assert.match(grammar, /^\+ mount Name \| kind: horse\|mule\|cart\|… \| pace: km\/day \| where: /);
    assert.match(grammar, /one line for each animal or vehicle, named for what tells it apart/);
    assert.match(grammar, /count: only for a string of pack animals that is never split/);
});
