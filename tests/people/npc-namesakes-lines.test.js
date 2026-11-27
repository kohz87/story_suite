// A line that writes a name two living people share, each with a nickname (real adapter): it goes to the one the scene has, else it is refused and writes
// nothing. People who share a name without nicknames (an old chat) are handled exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, cast, note, person } from './npc-alias-lines.helpers.js';
import { fakeDelta, host } from './storysuite-v2-meters.helpers.js';

const REFUSAL = 'Two people are called Guard; write Old Tom or the gate guard.';
const tom = (extra = {}) => person('npc_g1', 'Guard', ['Old Tom'], { present: false, secrets: [note('Tom')], ...extra });
const gate = (extra = {}) => person('npc_g2', 'Guard', ['the gate guard'], { present: false, ...extra });
const QUOTE = 'He admits it: a spare oar lies under the bench.';
const reveal = name => `~ reveal ${name} | opened: ${ID} | quote: "a spare oar lies under the bench"`;
// (the meters host has no Story Block scene of its own: an empty one leaves presence to the dossiers)
const staged = async (...records) => {
    const h = await cast(...records);
    h.registry.register({ id: 'test-scene', name: 'Scene', queries: { 'scene.present': () => [] } });
    return h;
};
const LINES = ['~ npc Guard | trust: +5', '~ npc Guard | memory: held the door', '+ milestone Guard — shared a watch', '~ taste Guard | likes: strong tea', '~ memory Guard | Saw the cart leave.', '~ npc Guard | died | how: fell from the wall'];

test('with one of them present, "~ npc Guard" and the other lines go to that one, memory included', async () => {
    const h = await staged(tom(), gate({ present: true }));
    for (const line of LINES.slice(0, 5)) h.line(line);
    assert.deepEqual(Object.keys(h.bonds()), ['npc_g2']);
    assert.equal(h.bonds().npc_g2.meters.trust, 15);
    assert.match(h.bonds().npc_g2.tastes, /strong tea/);
    const people = h.store.head().domains.people.npcs;
    assert.deepEqual(people.npc_g1.memories ?? [], []);
    assert.deepEqual(people.npc_g2.memories, ['held the door', 'shared a watch', 'Saw the cart leave.']);
});

for (const [what, present] of [['none', false], ['both', true]]) {
    test(`with ${what} of them present, every kind of line for the shared name is refused in those words and writes nothing`, async () => {
        const h = await cast(tom({ present }), gate({ present }));
        const before = structuredClone(h.store.head().domains.people);
        for (const line of [...LINES, '~ tie Guard | with: Old Tom | tag: +friend']) assert.equal(h.refused(line).message, REFUSAL, line);
        const [result] = h.reply(QUOTE, reveal('Guard')).results;
        assert.equal(result.message, REFUSAL);
        assert.deepEqual(h.store.head().domains.people, before);
    });
}

test('a tie\'s "with: Guard" is settled too', async () => {
    const mira = person('npc_mira', 'Mira');
    const none = await cast(tom(), gate(), mira);
    assert.equal(none.refused('~ tie Mira | with: Guard | tag: +friend').message, REFUSAL);
    const one = await cast(tom(), gate({ present: true }), mira);
    one.line('~ tie Mira | with: Guard | tag: +friend');
    assert.deepEqual(JSON.parse(one.bonds().npc_mira.ties), { 'the-gate-guard': ['friend'] });
});

test('the nickname, and the name as the list shows it, say which one, present or not', async () => {
    const h = await cast(tom(), gate({ present: true }));
    h.line('~ npc Old Tom | trust: +5');
    h.line('~ npc Guard "Old Tom" | trust: +1');
    h.line('~ npc the gate guard | trust: -1');
    assert.deepEqual([h.bonds().npc_g1.meters.trust, h.bonds().npc_g2.meters.trust], [16, 9]);
    const [result] = h.reply(QUOTE, reveal('Guard "Old Tom"')).results;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(h.bonds().npc_g1.unlocked, [ID]);
});

test('three of them: the refusal lists all three', async () => {
    const h = await cast(tom(), gate(), person('npc_g3', 'Guard', ['Red'], { present: false }));
    assert.equal(h.refused('~ npc Guard | trust: +1').message, 'Several people are called Guard; write Old Tom, the gate guard or Red.');
});

test('a nickname the scene lists settles it, before the stored presence', async () => {
    const answers = { 'scene.present': ['Old Tom'] };
    const h = await host({ delta: Object.assign(fakeDelta(), { records: { npc_g1: tom(), npc_g2: gate({ present: true }) } }), linesMode: true, answers });
    h.registry.register({ id: 'test-scene', name: 'Scene', queries: { 'scene.present': () => ['Old Tom'] } });
    const [result] = h.reply('Later.', '~ npc Guard | trust: +5').results;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(Object.keys(h.store.head().domains.people.bonds.npcs), ['npc_g1']);
});

test('with lines mode off the same rule holds', async () => {
    const h = await host({ delta: Object.assign(fakeDelta(), { records: { npc_g1: tom(), npc_g2: gate() } }) });
    const [result] = h.reply('Later.', '~ npc Guard | trust: +5').results;
    assert.equal(result.message, REFUSAL);
    assert.deepEqual(h.store.head().domains.people.bonds?.npcs ?? {}, {});
});

test('a dead namesake does not count: the living one is the only Guard', async () => {
    const h = await cast(tom(), gate({ lifeState: 'deceased', lifeStateCertainty: 'explicit' }));
    h.line('~ npc Guard | trust: +5');
    assert.deepEqual(Object.keys(h.bonds()), ['npc_g1']);
});

// An old chat: two Guards, neither with a nickname. The expected values are what the code before this change wrote.
for (const present of [false, true]) {
    test(`two Guards without nicknames behave as before (the second present: ${present})`, async () => {
        const h = await staged(person('npc_g1', 'Guard', [], { present: false }), person('npc_g2', 'Guard', [], { present }));
        const results = [...LINES.slice(0, 5)].map(line => h.line(line));
        assert.equal(results.length, 5);
        // (as before: the line's meters go to the first of them that has an entry or comes first; its memory to the first living one)
        assert.deepEqual(Object.keys(h.bonds()), ['npc_g1']);
        assert.equal(h.bonds().npc_g1.meters.trust, 15);
        const people = h.store.head().domains.people.npcs;
        assert.deepEqual(people.npc_g1.memories, ['held the door', 'shared a watch', 'Saw the cart leave.']);
        assert.deepEqual([people.npc_g1.aliases, people.npc_g2.aliases], [[], []]);
    });
}

test('one nickname between two is not enough: the shared name still goes as before', async () => {
    const h = await cast(person('npc_g1', 'Guard', [], { present: false }), tom({ id: 'npc_g2' }));
    h.line('~ npc Guard | trust: +5');
    assert.deepEqual(Object.keys(h.bonds()), ['npc_g1']);
});
