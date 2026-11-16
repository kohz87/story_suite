// Interaction dice are the board's dice lane for lane, step for step, with the board's seed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { boardDice, fightSeed as oldFightSeed } from '../../../src/v2/lean-rpg/board/dice.js';
import { dice, interactionSeed } from '../../../src/v2/interaction/dice.js';
import { boardDice as newBoardDice, fightSeed } from '../../../src/v2/interaction.js';

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
        assert.equal(fightSeed('reply-id', attempt), oldFightSeed('reply-id', attempt));
        assert.notEqual(interactionSeed('reply-id', attempt, 'example/fishing'), oldFightSeed('reply-id', attempt));
    }
    assert.equal(newBoardDice(42, 3)('foe', 2)(), boardDice(42, 3)('foe', 2)());
});
