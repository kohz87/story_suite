// The v1 dice rule, pinned: the dice are keyed for the interaction port (interaction/dice.js), the kind does not own them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_SPAN, fightDice } from '../../../../src/v2/lean-rpg/combat/dice.js';
import { dice } from '../../../../src/v2/interaction/dice.js';

const LANES = { act: 1, foe: 2, check: 3, init: 4, open: 5, flee: 6 };

test('a fight die is the port stream of step exchange * SLOT_SPAN + slot, on the board lane of its kind, at position 0', () => {
    for (const seed of [0, 7, 123456789, 0xFFFFFFFF]) for (const exchange of [0, 1, 17, 98]) for (const [kind, lane] of Object.entries(LANES)) for (const slot of [0, 50, 154, 1040, 1000050]) {
        const mine = Array.from({ length: 4 }, () => fightDice(seed, exchange)(kind, slot)());
        const port = Array.from({ length: 4 }, () => dice(seed)(exchange * SLOT_SPAN + slot)(lane, 0)());
        assert.deepEqual(mine, port, `${seed}/${exchange}/${kind}/${slot}`);
    }
});

test('the dice have no other source: an unknown kind is refused and no shared state advances', () => {
    assert.throws(() => fightDice(1, 1)('luck', 0), /Unknown dice kind/);
    const first = fightDice(9, 2)('act', 40)();
    fightDice(9, 2)('foe', 40)();
    assert.equal(fightDice(9, 2)('act', 40)(), first, 'asking again gives the same die');
    assert.ok(SLOT_SPAN > 1000050 + 10 * 6, 'every slot the engine uses fits inside one exchange step');
});
