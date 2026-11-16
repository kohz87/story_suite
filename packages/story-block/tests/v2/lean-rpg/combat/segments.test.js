// A fight continued across replies: one whole fight equals the same fight split into segments (a segment starts from the earlier record, through JSON as a reload would),
// at every split point, with a forced flee and with a result that lands in a later segment. Initiative is rolled once; exchange numbers count on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playBoard } from '../../../../src/v2/lean-rpg/combat/play.js';
import { withSkills } from './derived-skills.helper.js';

const hero = (label, build, stats) => withSkills({ label, id: label, build, level: 12, mastery: 3, stats: { str: 8, vit: 20, agi: 8, dex: 8, int: 8, wis: 8, cha: 5, ...stats } });
const PARTY = [hero('Ana', 'Warrior', { str: 20 }), hero('Bo', 'Skirmisher-area', { agi: 20 }), hero('Cy', 'Healer', { int: 14, wis: 14 })];
const foes = (hp, count = 3) => Array.from({ length: count }, (_, at) => ({ id: `f${at}`, label: `Wolf ${at + 1}`, tier: 'standard', level: 6, hp, maxHp: hp, damage: 3, roll: 8 }));
const keep = value => JSON.parse(JSON.stringify(value));
const turns = count => Array.from({ length: count }, () => ({}));

function split(input, setup, cuts, total) {
    const segments = [];
    let sheet = input, start, done = 0;
    for (const cut of [...cuts, total]) {
        const take = cut - done;
        if (take < 1) continue;
        const run = keep(playBoard(sheet, { ...setup, ...(start ? { start } : {}) }, turns(take)));
        segments.push(run);
        done = run.exchanges;
        if (run.result !== 'unfinished') break;
        sheet = { party: run.party, foes: run.foes };
        start = { offset: run.exchanges, order: run.order, rotation: run.rotation };
    }
    return segments;
}

function assertSame(whole, parts, label) {
    const last = parts[parts.length - 1];
    assert.deepEqual(parts.flatMap(part => part.lines), whole.lines, `${label}: lines`);
    assert.deepEqual(parts.flatMap(part => part.moves), whole.moves, `${label}: moves`);
    assert.deepEqual(parts.flatMap(part => part.rounds), whole.rounds, `${label}: rounds`);
    for (const key of ['result', 'exchanges', 'rotation', 'order', 'party', 'foes']) assert.deepEqual(last[key], whole[key], `${label}: ${key}`);
}

test('one whole fight equals the same fight split into segments, wherever it is split', () => {
    const input = { party: PARTY, foes: foes(400) }, setup = { seed: 20260716, maxExchanges: 60 };
    const whole = playBoard(input, setup, turns(8));
    assert.equal(whole.result, 'unfinished');
    assert.equal(whole.exchanges, 8);
    for (const cuts of [[1], [3], [7], [2, 5], [1, 2, 3, 4, 5, 6, 7]]) assertSame(whole, split(input, setup, cuts, 8), `split at ${cuts}`);
});

test('a segment rolls no initiative again, and a carried foe keeps its tier, damage and HP', () => {
    const input = { party: PARTY, foes: [{ id: 'e0', label: 'Ogre', tier: 'elite', level: 9, hp: 300, maxHp: 300 }] };
    const [first, second] = split(input, { seed: 5 }, [2], 4);
    assert.equal(first.lines.filter(line => line[0] === 'init').length, 4);
    assert.equal(second.lines.filter(line => line[0] === 'init' || line[0] === 'order').length, 0);
    assert.equal(second.lines.find(line => line[0] === 'exchange')[1], 3, 'exchange numbers count on');
    assert.equal(second.foes[0].tier, 'elite');
    assert.equal(second.foes[0].damage, first.foes[0].damage);
    assert.ok(second.foes[0].hp < 300 && second.foes[0].hp <= first.foes[0].hp);
});

test('a result that lands in a later segment, and a forced flee keyed by the absolute exchange number, split the same way', () => {
    const win = { party: PARTY, foes: foes(40, 2) }, setup = { seed: 99, maxExchanges: 60 };
    const whole = playBoard(win, setup, turns(30));
    assert.equal(whole.result, 'win');
    assert.ok(whole.exchanges > 2, 'the fight outlasts the first cut');
    assertSame(whole, split(win, setup, [2], 30), 'win in a later segment');
    const run = { party: PARTY, foes: foes(400) }, fleeing = { seed: 3, flee: { 3: ['Ana', 'Bo', 'Cy'] } };
    const gone = playBoard(run, fleeing, turns(5));
    assertSame(gone, split(run, fleeing, [2], 5), 'flee at exchange 3');
});

test('the cap counts the whole fight, and a damaged or mismatched start is refused', () => {
    const input = { party: PARTY, foes: foes(400) };
    const [first] = split(input, { seed: 8 }, [], 3);
    const next = { party: first.party, foes: first.foes }, start = { offset: first.exchanges, order: first.order, rotation: first.rotation };
    assert.equal(playBoard(next, { seed: 8, maxExchanges: 5, start }, turns(9)).exchanges, 5, 'room is the cap minus the exchanges played');
    assert.equal(playBoard(next, { seed: 8, maxExchanges: 3, start }, turns(2)).exchanges, 3, 'no room left: nothing more is played');
    for (const bad of [{ ...start, offset: 0 }, { ...start, rotation: -1 }, { ...start, order: { ...start.order, first: 'both' } }, { ...start, order: { ...start.order, foes: ['nobody'] } }, 5]) {
        assert.throws(() => playBoard(next, { seed: 8, start: bad }, turns(1)), /fight start/);
    }
});
