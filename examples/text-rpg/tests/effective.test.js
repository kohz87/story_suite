import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSkills, effectiveStats } from '../src/module-parts/effective.js';
import { pointsOf } from '../src/module-parts/standing.js';
import { astra } from './helpers/fake-ctx.js';

test('the level pays for the earliest purchases, in order; the later ones wait', () => {
    const me = astra({ xp: 150 });
    me.bought = { b: { stat: 'int', n: 1, seq: 1 }, a: { stat: 'str', n: 1, seq: 0 }, c: { stat: 'cha', n: 1, seq: 2 } };
    assert.deepEqual([effectiveStats(me).str, effectiveStats(me).int, effectiveStats(me).cha, pointsOf(me)], [13, 13, 12, 0]);
    me.xp = 50;
    assert.deepEqual([effectiveStats(me).str, effectiveStats(me).int, pointsOf(me)], [13, 12, 0]);
    me.xp = 0;
    assert.deepEqual([effectiveStats(me).str, pointsOf(me)], [12, 0]);
});

test('skills past the level\'s slots go inactive latest first; creation skills always count', () => {
    const me = astra({ xp: 150 });
    for (const [at, name] of ['A', 'B', 'C', 'D'].entries()) me.skills.push({ name, about: '', stat: 'str', type: 'utility', cost: null, learned: at });
    assert.deepEqual(activeSkills(me).map(skill => skill.name), ['Obscure', 'Lore', 'A', 'B', 'C', 'D']);
    me.xp = 0;
    assert.deepEqual(activeSkills(me).map(skill => skill.name), ['Obscure', 'Lore', 'A', 'B', 'C']);
});
