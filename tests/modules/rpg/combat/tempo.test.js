// Combat Rules v1 tempo: the AGI cap (Movement adds one), the win-by-3 rule, and a chain that stops at the cap.

import test from 'node:test';
import assert from 'node:assert/strict';
import { rng as seeded } from '../../../../core/commands/rng.js';
import { tempoChain } from '../../../../modules/rpg/combat/tempo.js';
import { RANKS } from '../../../../modules/rpg/combat/numbers.js';
import { bonusesOf, tempoWins } from '../v1/oracle.js';

const random = seeded(0xC2_0002);
const STANCES = [null, 'defence', 'evasion', 'movement', 'support'];

test('the cap follows AGI and a Movement stance raises it by one, over the whole stat range', () => {
    for (let agi = 1; agi <= 30; agi++) {
        for (const stance of STANCES) {
            const mastery = RANKS[Math.floor(random() * RANKS.length)].mastery;
            const expected = bonusesOf({ agi }, 50, mastery, stance).tempoCap;
            assert.equal(tempoChain({ agility: agi, stance }).cap, expected, `AGI ${agi}, ${stance}`);
        }
    }
    assert.deepEqual([14, 15, 24, 25].map(agi => tempoChain({ agility: agi }).cap), [1, 2, 2, 3]);
    assert.deepEqual([14, 15, 24, 25].map(agi => tempoChain({ agility: agi, stance: 'movement' }).cap), [2, 3, 3, 4]);
});

test('only a margin of 3 or more wins a tempo roll', () => {
    for (let margin = -20; margin <= 20; margin++) {
        assert.equal(tempoChain({ agility: 10, margin }).won, tempoWins(20, margin, 20));
    }
    assert.equal(tempoChain({ agility: 10, margin: 2 }).won, false);
    assert.equal(tempoChain({ agility: 10, margin: 3 }).won, true);
});

test('a won chain earns one action at a time and stops at the cap', () => {
    const chain = (agility, stance = null) => {
        const steps = [];
        let used = 0;
        for (let i = 0; i < 6; i++) {
            const step = tempoChain({ agility, stance, margin: 9, used });
            steps.push(step);
            used = step.chain;
        }
        return steps;
    };
    assert.deepEqual(chain(5).map(step => step.extra), [true, false, false, false, false, false]);
    assert.deepEqual(chain(20).map(step => step.extra), [true, true, false, false, false, false]);
    assert.deepEqual(chain(28).map(step => step.extra), [true, true, true, false, false, false]);
    assert.deepEqual(chain(5, 'movement').map(step => step.extra), [true, true, false, false, false, false]);
    assert.deepEqual(chain(5).map(step => step.chain), [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(chain(20).map(step => step.chain), [1, 2, 2, 2, 2, 2]);
    assert.equal(tempoChain({ agility: 20, margin: 3, used: 2 }).extra, false);
});

test('junk input is safe: missing AGI uses the floor, missing margin does not win, and used is whole', () => {
    assert.equal(tempoChain().cap, 1);
    assert.equal(tempoChain().won, false);
    assert.equal(tempoChain({ agility: 99 }).cap, 3);
    assert.equal(tempoChain({ agility: 20, margin: 4, used: 'x' }).extra, true);
});
