// A fight carried over several replies through the sheet reader's path (fightInputOf(sheet, { carried })): the sheet is written back after each segment (the record's bars,
// then the death latch: Down at the first reply end at 0 HP, not alive at the next), and the segments still equal the whole fight, even with a hero who is out of it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fightInputOf } from '../../../../modules/rpg/combat/input.js';
import { playBoard } from '../../../../modules/rpg/combat/play.js';
import { seeded } from './dice.helper.js';

const stats = (extra = {}) => ({ str: 14, vit: 12, agi: 9, dex: 9, int: 8, wis: 8, cha: 5, ...extra });
const character = (key, hp, extra = {}) => ({
    v1: true, key, who: key.toUpperCase(), module: `pack.chat/${key}`, level: 6, stats: stats(extra), alive: true, hp, mp: 6, sp: 14, max: { hp: 200, mp: 8, sp: 14 },
    skills: [{ name: 'Slash', type: 'attack', stat: 'str', practice: 40 }],
});
const sheet = () => ({ characters: [character('ana', 200), character('bo', 1), character('cy', 200)], foes: [{ v1: true, slot: 1, filled: true, name: 'Ogre', count: 1, level: 14, tier: 'boss' }] });
const turns = count => Array.from({ length: count }, () => ({}));
const keep = value => JSON.parse(JSON.stringify(value));

// what the host does between replies: the record's bars go back to the sheet; the death latch runs at each reply end
function writeBack(from, record) {
    const next = structuredClone(from);
    for (const hero of record.party) {
        const row = next.characters.find(each => each.key === hero.id);
        Object.assign(row, { hp: hero.hp, mp: hero.mp, sp: hero.sp });
        if (row.down && hero.hp === 0) row.alive = false;
        row.down = hero.hp === 0;
    }
    return next;
}

test('a fight carried over replies through the reader equals the whole fight, with a hero who goes Down in segment 1 and is out of the sheet\'s living by segment 3', () => {
    const setup = { seed: 77, maxExchanges: 60 }, base = sheet();
    const whole = playBoard(fightInputOf(base), seeded(setup), turns(6));
    assert.ok(whole.party.find(hero => hero.id === 'bo').hp === 0, 'the weak hero is Down in the whole fight');
    const parts = [];
    let now = base, start, carried = null;
    for (let at = 0; at < 3; at += 1) {
        const input = fightInputOf(now, { carried });
        const run = keep(playBoard(input, seeded({ ...setup, ...(start ? { start } : {}) }), turns(2)));
        parts.push(run);
        start = { offset: run.exchanges, order: run.order, rotation: run.rotation };
        carried = run; now = writeBack(now, run);
    }
    assert.equal(now.characters.find(each => each.key === 'bo').alive, false, 'the latch has taken the hero out of the living by the last segment');
    assert.deepEqual(parts.flatMap(part => part.lines), whole.lines);
    assert.deepEqual(parts.flatMap(part => part.moves), whole.moves);
    for (const key of ['result', 'exchanges', 'rotation', 'order', 'party', 'foes']) assert.deepEqual(parts[2][key], whole[key], key);
});

test('with a carried record the party is the record\'s roster, so a dead hero stays at 0 HP; without one a dead hero is left out and a new hero is not added', () => {
    const base = sheet(), first = playBoard(fightInputOf(base), seeded({ seed: 3 }), turns(2));
    base.characters[1].alive = false; base.characters[1].hp = 0;
    assert.deepEqual(fightInputOf(base).party.map(hero => hero.id), ['ana', 'cy'], 'a new fight leaves the dead out');
    const carried = fightInputOf(base, { carried: first });
    assert.deepEqual(carried.party.map(hero => hero.id).sort(), ['ana', 'bo', 'cy']);
    assert.equal(carried.party.find(hero => hero.id === 'bo').hp, 0);
    base.characters.push(character('di', 200));
    assert.deepEqual(fightInputOf(base, { carried: first }).party.map(hero => hero.id).sort(), ['ana', 'bo', 'cy'], 'a hero who joined after the start is not in the carried fight');
    const start = { offset: first.exchanges, order: first.order, rotation: first.rotation };
    assert.doesNotThrow(() => playBoard(fightInputOf(base, { carried: first }), seeded({ seed: 3, start }), turns(1)));
});
