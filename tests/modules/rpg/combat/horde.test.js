// A horde's reserve rules (combat/horde.js): the checked setup, the refill of emptied slots (ids, labels, waves, order) and the leader's fall. Pure, no dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hordeOf, hordeStart, leaderDown, refill } from '../../../../modules/rpg/combat/horde.js';

const group = (name, count, extra = {}) => ({ name, count, level: 3, tier: 'minion', ...extra });
const members = (slot, name, count, hp = 4) => Array.from({ length: count }, (_, at) => ({ id: `${slot}.${at + 1}`, label: count > 1 ? `${name} ${at + 1}` : name, hp, maxHp: 4, level: 3, tier: 'minion' }));
const orderOf = foes => ({ party: ['a'], foes: foes.map(foe => foe.id), first: 'party' });

test('hordeOf keeps a well-formed horde and refuses one past its limits', () => {
    const ok = { v: 1, reserve: [group('Ghoul', 6), group('Warlord', 1, { tier: 'boss', leader: true })], hold: 8 };
    assert.deepEqual(hordeOf(ok), ok);
    assert.equal(hordeOf({ ...ok, v: 2 }), null, 'an unknown version');
    assert.equal(hordeOf({ v: 1, reserve: Array.from({ length: 13 }, () => group('Rat', 1)) }), null, 'more than 12 groups');
    assert.equal(hordeOf({ v: 1, reserve: Array.from({ length: 9 }, () => group('Rat', 6)) }), null, 'more than 48 foes in reserve');
    assert.equal(hordeOf({ v: 1, reserve: [group('Rat', 7)] }), null, 'a group past six');
    assert.equal(hordeOf({ v: 1, reserve: [group('Rat', 2, { tier: 'dragon' })] }), null, 'an unknown tier');
    assert.equal(hordeOf({ v: 1, reserve: [group('Rat', 2)], hold: 3 }), null, 'a hold under 4');
    assert.equal(hordeOf({ v: 1, reserve: [group('Rat', 2)], hold: 21 }), null, 'a hold over 20');
    assert.equal(hordeOf({ v: 1, reserve: [group('Boss', 1, { leader: true })], leaderSlot: 2 }), null, 'two leaders');
    assert.equal(hordeOf({ v: 1, reserve: [] }), null, 'nothing to come, no hold, no leader: an ordinary fight');
    assert.deepEqual(hordeOf({ v: 1, reserve: [], hold: 6 }), { v: 1, reserve: [], hold: 6 }, 'hold the gate with no reserve');
    assert.deepEqual(hordeStart({ v: 1, reserve: [], leaderSlot: 2 }), { next: 0, wave: 0, leader: '2' });
});

test('refill: only emptied slots take the next groups, in slot order, as one wave with fresh ids and labels that never repeat', () => {
    const horde = hordeOf({ v: 1, reserve: [group('Ghoul', 2), group('Ghoul', 3), group('Ghoul Warlord', 1, { tier: 'boss', level: 6, leader: true })] });
    const foes = [...members(1, 'Ghoul', 2, 0), ...members(2, 'Rat', 1, 3), ...members(3, 'Ghoul', 1, 0)];
    foes[3].label = 'Ghoul 3';
    const once = refill(foes, orderOf(foes), horde, hordeStart(horde));
    assert.deepEqual(once.lines, [['arrive', 1, 1, 'Ghoul', 2, 3, 'minion', 4], ['arrive', 1, 3, 'Ghoul', 3, 3, 'minion', 1]]);
    const added = once.foes.slice(foes.length);
    assert.deepEqual(added.map(foe => [foe.id, foe.label, foe.hp]), [['1.1.1', 'Ghoul 4', 4], ['1.1.2', 'Ghoul 5', 4], ['3.1.1', 'Ghoul 6', 4], ['3.1.2', 'Ghoul 7', 4], ['3.1.3', 'Ghoul 8', 4]]);
    assert.deepEqual(once.order.foes, [...foes.map(foe => foe.id), ...added.map(foe => foe.id)], 'arrivals join the end of the foe order');
    assert.deepEqual(once.state, { next: 2, wave: 1, leader: null });
    // the Rat's slot is not empty: nothing comes there; slot 1's new wave falls, then the leader comes alone under his bare name
    const beaten = once.foes.map(foe => (foe.id.startsWith('1.1.') ? { ...foe, hp: 0 } : foe));
    const twice = refill(beaten, once.order, horde, once.state);
    assert.deepEqual(twice.foes.slice(beaten.length).map(foe => [foe.id, foe.label, foe.tier, foe.level]), [['1.2.1', 'Ghoul Warlord', 'boss', 6]]);
    assert.deepEqual(twice.state, { next: 3, wave: 2, leader: '1.2' });
    assert.equal(leaderDown(twice.foes, twice.state), false);
    assert.equal(leaderDown(twice.foes.map(foe => (foe.id === '1.2.1' ? { ...foe, hp: 0 } : foe)), twice.state), true);
    // the reserve spent: nothing more comes, the same foes and state come back
    const spent = refill(twice.foes.map(foe => ({ ...foe, hp: 0 })), twice.order, horde, twice.state);
    assert.deepEqual(spent.lines, []);
    assert.equal(spent.state, twice.state);
});

test('refill and leaderDown are pure: the same input gives the same output, and the input is not changed', () => {
    const horde = hordeOf({ v: 1, reserve: [group('Ghoul', 6), group('Ghoul', 6)], leaderSlot: 2 });
    const foes = [...members(1, 'Ghoul', 6, 0), ...members(2, 'Chief', 1)], copy = structuredClone(foes);
    assert.deepEqual(refill(foes, orderOf(foes), horde, hordeStart(horde)), refill(copy, orderOf(copy), horde, hordeStart(horde)));
    assert.deepEqual(foes, copy);
    assert.equal(leaderDown(foes, hordeStart(horde)), false, 'the front leader stands');
    assert.equal(leaderDown(foes.map(foe => ({ ...foe, hp: 0 })), hordeStart(horde)), true);
    assert.equal(leaderDown(foes, { next: 0, wave: 0, leader: null }), false, 'no leader, no such end');
});
