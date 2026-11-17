// Interaction dice are the fight's dice lane for lane, step for step, with the fight's seed: the numbers are pinned here by their own formula (the earlier engine's helper is gone), so a change to them shows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../../../core/persist.js';
import { rng } from '../../../core/commands/rng.js';
import { dice, interactionSeed } from '../../../core/interaction/dice.js';

// The fight's seed and one d20 stream per lane and position: the formulas the interaction port has always used for a fight.
const oldFightSeed = (sid, attempt = 0) => Number.parseInt(hash(`fight:${String(sid)}:${attempt}`), 16) >>> 0;
const boardDice = (seed, number) => {
    const base = Number.parseInt(hash(`exchange:${seed >>> 0}:${number}`), 16) >>> 0, kinds = { act: 1, foe: 2, check: 3, init: 4, open: 5, flee: 6 };
    return (kind, at) => { const random = rng((base ^ Math.imul(kinds[kind] * 64 + at + 1, 0x9E3779B1)) >>> 0); return () => 1 + Math.floor(random() * 20); };
};
const LANES = { act: 1, foe: 2, check: 3, init: 4, open: 5, flee: 6 };

test('dice(i)(lane, at) equals boardDice(seed, offset + i + 1) for every lane, position and step', () => {
    const seed = 0x51a7c0de;
    for (const offset of [0, 5]) for (let step = 0; step < 6; step += 1) {
        for (const [kind, lane] of Object.entries(LANES)) for (let at = 0; at < 8; at += 1) {
            const actual = Array.from({ length: 12 }, dice(seed, offset)(step)(lane, at));
            const expected = Array.from({ length: 12 }, boardDice(seed, offset + step + 1)(kind, at));
            assert.deepEqual(actual, expected, `${kind} lane ${lane}, at ${at}, step ${step}, offset ${offset}`);
        }
    }
});

test('the board seed is exactly the old fight seed, while another kind gets its own stable seed', () => {
    for (const attempt of [0, 1, 7]) {
        assert.equal(interactionSeed('reply-id', attempt, 'story-block/fight'), oldFightSeed('reply-id', attempt));
        assert.notEqual(interactionSeed('reply-id', attempt, 'example/fishing'), oldFightSeed('reply-id', attempt));
    }
});

test('the fight seeds are pinned to their numbers', () => {
    assert.deepEqual([0, 1, 7].map(attempt => interactionSeed('reply-id', attempt, 'story-block/fight')), [1732441045, 1715663426, 1614997712]);
});
