// A mount whose `where` names the reader's character or a party member travels with the party: in the bag, on the Mount slot, in the carry
// limit for new replies; a Re-read of a reply captured before that keeps the old judgement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../../../core/replay.js';
import { selectBag } from '../../../ui/select/bag.js';
import { ridersOf } from '../../../modules/scene/mounts-parts/riders.js';
import { mountsTail } from '../../../modules/scene/mounts.js';
import { gearMatches, planGear } from '../../../modules/rpg/gear.js';
import { readSheet } from '../../../modules/rpg/read.js';
import { createGearQueries, travelsWith } from '../../../modules/inventory/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../modules/inventory/index.js';
import { rosterQueries } from '../../../modules/rpg/roster.js';
import { CORE_KINDS } from '../../../modules/scene/domains/index.js';
import { character, sheetDomain } from '../rpg/helpers.js';
import { def, stack } from './fixtures.js';
import { newHost, reply, withAstra } from '../../../examples/text-rpg/tests/helpers/host.js';

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

test('a persona rename between capture and Re-read changes nothing: story lines are judged by the names held in state', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const [rider, kept] of [['Torka', 2], ['persona', 0]]) {
        const host = await newHost(FEATURES);
        t.after(() => host.close());
        const persona = host.ctx.name1;
        assert.ok(persona && persona !== 'Torka');
        await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul', '~ place Sealcrown', `+ mount Bay Gelding | kind: horse | where: ${rider === 'persona' ? persona : rider}`]));
        // The display keeps the live persona name: the bag counts its horse.
        assert.deepEqual(host.sdk.query('gear.view', {}).carriers.mounts.map(row => row.withParty), [true], rider);
        const without = host.sdk.query('gear.carry', { riders: false }).capacity;
        await host.send('Stones.', reply('Stones.', [`+ item Stone | qty: ${without}`]));
        await host.send('More.', reply('A quiet find.', ['+ item Rock | qty: 2']));
        assert.equal(rocks(host), kept, `${rider}: captured`);
        const state = hashJson(host.head().domains.inventory);
        host.ctx.name1 = 'Another Name';
        assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
        assert.equal(rocks(host), kept, `${rider}: after the rename`);
        assert.equal(hashJson(host.head().domains.inventory), state, `${rider}: the same inventory`);
    }
});

test('the narrator\'s line says rows of one kind, pace and with-you state once, keeping every name and what only it says', () => {
    const row = (name, more = {}) => [`m:${name}`, { name, kind: 'horse', count: 1, pace: 55, condition: '', where: '', ...more }];
    const tailOfRows = rows => mountsTail({ domains: { scene: { place: { name: 'Mill Road' }, mounts: Object.fromEntries(rows) } } }, CREW);
    assert.equal(tailOfRows([row('Bay Gelding', { where: 'ridden by Rav' }), row('Roan', { where: 'Torka, Rika' }), row('Dun', { where: 'ridden by Sister Temiwa' }), row('Black', { where: 'with the party' }), row('Colt')]),
        'Mounts: horse ×5 (55 km/day) with the party (Rav, Torka, Rika, Sister Temiwa): Bay Gelding, Roan, Dun, Black, Colt');
    assert.equal(tailOfRows([row('Bay', { where: 'ridden by Rav' }), row('Grey', { condition: 'lame' }), row('Roan', { where: 'led by Tam' }), row('Pia', { where: 'Rika, Corporal Stenn' }), row('Filly', { count: 2, where: 'at Mill Road' }), row('Nag', { pace: 35 })]),
        'Mounts: horse ×6 (55 km/day) with the party (Rav): Bay, Grey (lame), Roan (led by Tam), Pia (Rika, Corporal Stenn), Filly ×2 (at Mill Road); Nag (horse, 35 km/day)');
    assert.equal(tailOfRows([row('Burr', { kind: 'mule', pace: 25, where: 'stabled at the Stray Oar' }), row('Colt'), row('Tib', { kind: 'Mule', pace: 25, count: 2, condition: 'tired', where: 'stabled at the Stray Oar' }), row('Old Pia', { kind: 'mule', pace: 25, where: 'penned at the Weir' })]),
        'Mounts: mule ×3 (25 km/day) stabled at the Stray Oar: Burr, Tib ×2 (tired); Colt (horse, 55 km/day); Old Pia (mule, 25 km/day, penned at the Weir)');
});

test('the stored player character counts as a rider for a story line, before and after a persona rename', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra(FEATURES);
    t.after(() => host.close());
    await host.send('Hello.', reply('Saddle up.', ['~ place Sealcrown', '+ mount Bay Gelding | kind: horse | where: Astra']));
    const limit = host.sdk.query('gear.carry', { stored: true }).capacity;
    const without = host.sdk.query('gear.carry', { riders: false }).capacity;
    assert.ok(limit > without, 'the stored character\'s horse adds room without the persona');
    await host.send('Stones.', reply('Stones.', [`+ item Stone | qty: ${without}`]));
    await host.send('More.', reply('A quiet find.', ['+ item Rock | qty: 2']));
    assert.equal(rocks(host), 2);
    host.ctx.name1 = 'Another Name';
    assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(rocks(host), 2, 'after the rename');
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
