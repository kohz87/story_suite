// A horde played by the engine (combat/exchange.js + play.js): the win waits for the reserve, the refill comes after the foe phase, arrivals act from the next exchange,
// the leader's fall and a held gate end it, a fight with no horde is byte-for-byte as before, and the same seed plays the same horde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playBoard } from '../../../../modules/rpg/combat/play.js';
import { dice } from '../../../../core/interaction/dice.js';

const stats = n => ({ str: n, vit: n, agi: n, dex: n, int: 5, wis: 5 });
const party = (n = 18, level = 20) => [{ id: 'a', label: 'Ana', level, stats: stats(n) }, { id: 'b', label: 'Bo', level, stats: stats(n) }];
const front = (slot, name, count, level = 2, tier = 'minion') => Array.from({ length: count }, (_, at) => ({ id: `${slot}.${at + 1}`, label: count > 1 ? `${name} ${at + 1}` : name, level, tier }));
const reserve = (n, count = 3) => Array.from({ length: n }, () => ({ name: 'Ghoul', count, level: 2, tier: 'minion' }));
const play = (foes, setup, heroes = party()) => playBoard({ party: heroes, foes }, { dice: dice('horde-seed', 0), ...setup });
const rounds = record => record.rounds.map(lines => lines.map(line => line[0]));

test('a fight with no horde plays exactly as before: no horde, no end, the same record', () => {
    const foes = front(1, 'Rat', 3);
    const plain = play(foes, {}), none = play(foes, { horde: null });
    assert.deepEqual(none, plain);
    assert.equal(Object.hasOwn(plain, 'horde'), false);
    assert.equal(Object.hasOwn(plain, 'end'), false);
    assert.equal(plain.lines.some(line => line[0] === 'arrive'), false);
});

test('cleared: the front falls but the reserve keeps coming; the win comes only when the last wave is down', () => {
    const record = play(front(1, 'Ghoul', 3), { horde: { v: 1, reserve: reserve(3) } });
    assert.equal(record.result, 'win');
    assert.equal(record.end, 'cleared');
    assert.deepEqual(record.horde, { next: 3, wave: 3, leader: null });
    assert.equal(record.foes.length, 12);
    assert.ok(record.foes.every(foe => foe.hp === 0), 'every foe of every wave is down');
    const arrivals = record.lines.filter(line => line[0] === 'arrive');
    assert.deepEqual(arrivals.map(line => [line[1], line[2], line.at(-1)]), [[1, 1, 6], [2, 1, 3], [3, 1, 0]]);
    // the arrival is the exchange's last line, so the new foes neither act nor are struck in the exchange they come in
    for (const round of rounds(record)) if (round.includes('arrive')) assert.equal(round.at(-1), 'arrive');
    const next = record.rounds.findIndex(lines => lines.some(line => line[0] === 'arrive')) + 1;
    assert.ok(record.rounds[next].some(line => line[0] === 'attack' && /^Ghoul [4-6]$/u.test(line[3])), 'the next exchange fights the arrivals');
});

test('leader: a leader on the front falls and the horde breaks at once; the foes still standing stay standing and do not strike after', () => {
    const foes = [...front(1, 'Ghoul', 6, 3), ...front(2, 'Chief', 1, 1, 'mob')];
    const record = play(foes, { horde: { v: 1, reserve: reserve(4, 6), leaderSlot: 2 } }, party(18, 20));
    assert.equal(record.result, 'win');
    assert.equal(record.end, 'leader');
    assert.equal(record.foes.find(foe => foe.label === 'Chief').hp, 0);
    const last = record.rounds.at(-1);
    const fell = last.findIndex(line => line[0] === 'attack' && line[3] === 'Chief' && line[10] === 0);
    assert.ok(fell >= 0, 'the chief falls in the last exchange');
    if (record.order.first === 'party') assert.equal(last.slice(fell).some(line => line[0] === 'foe-phase'), false, 'no foe strikes after the leader falls');
});

test('held: the party that still stands when the hold\'s exchange ends wins, with foes left standing; a weak party falls first', () => {
    const foes = front(1, 'Ghoul', 6, 9, 'standard'), horde = { v: 1, reserve: reserve(10, 4), hold: 4 };
    const held = play(foes, { horde }, party(12, 30));
    assert.equal(held.result, 'win');
    assert.equal(held.end, 'held');
    assert.equal(held.exchanges, 4);
    assert.ok(held.foes.some(foe => foe.hp > 0), 'foes still stand when the gate has held');
    const weak = play(front(1, 'Ghoul', 6, 30, 'elite'), { horde }, party(5, 1));
    assert.equal(weak.result, 'loss');
    assert.equal(Object.hasOwn(weak, 'end'), false, 'a lost horde has no end word');
});

test('the same seed plays the same horde; a damaged horde or a damaged carried state is refused', () => {
    const setup = { horde: { v: 1, reserve: reserve(5), hold: 10 } };
    assert.deepEqual(play(front(1, 'Ghoul', 3), setup), play(front(1, 'Ghoul', 3), structuredClone(setup)));
    assert.throws(() => play(front(1, 'Ghoul', 3), { horde: { v: 1, reserve: reserve(13) } }), /horde is damaged/);
    const record = play(front(1, 'Ghoul', 3), { ...setup, maxExchanges: 2 });
    assert.equal(record.result, 'unfinished');
    const start = { offset: 2, order: record.order, rotation: record.rotation };
    const carried = { party: party(), foes: record.foes };
    assert.throws(() => playBoard(carried, { dice: dice('horde-seed', 2), ...setup, start }), /horde's start is damaged/, 'a horde segment without its moving state');
    assert.throws(() => playBoard(carried, { dice: dice('horde-seed', 2), ...setup, start: { ...start, horde: { ...record.horde, next: 9 } } }), /horde's start is damaged/);
    assert.doesNotThrow(() => playBoard(carried, { dice: dice('horde-seed', 2), ...setup, start: { ...start, horde: record.horde } }));
});
