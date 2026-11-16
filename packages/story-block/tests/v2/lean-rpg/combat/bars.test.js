// Combat Rules v1 bars: every row of the example-builds table (HP / MP / SP at L1, 15, 30, 50, 99).

import test from 'node:test';
import assert from 'node:assert/strict';
import { barsOf, hpOf, mpOf, spOf } from '../../../../src/v2/lean-rpg/combat/bars.js';
import { BUILDS, statsAt } from './builds.helpers.js';

const LEVELS = [1, 15, 30, 50, 99];
const TABLE = {
    Warrior: ['7/10/11', '14/13/16', '21/17/22', '29/22/30', '53/34/47'],
    Skirmisher: ['7/10/11', '14/13/16', '21/17/22', '29/22/30', '53/34/47'],
    Mage: ['7/13/10', '14/18/14', '21/23/19', '29/31/25', '53/47/40'],
    Healer: ['10/11/10', '17/16/14', '23/22/19', '32/30/25', '53/47/40'],
};

for (const [name, row] of Object.entries(TABLE)) {
    test(`${name}: HP / MP / SP at every listed level`, () => {
        LEVELS.forEach((lv, i) => {
            const b = barsOf(statsAt(BUILDS[name], lv), lv);
            assert.equal(`${b.hp}/${b.mp}/${b.sp}`, row[i], `${name} L${lv}`);
        });
    });
}

test('the three formulas, one by one', () => {
    const s = { str: 8, vit: 11, agi: 9, dex: 5, int: 7, wis: 6 };
    assert.equal(hpOf(s, 10), 5 + 3 + 5);
    assert.equal(mpOf(s, 10), 8 + 2 + 3);
    assert.equal(spOf(s, 10), 8 + 2 + 4);
});

test('a base character at level 1 has 7 / 10 / 10', () => {
    const s = { str: 5, vit: 5, agi: 5, dex: 5, int: 5, wis: 5 };
    assert.deepEqual(barsOf(s, 1), { hp: 7, mp: 10, sp: 10 });
});

test('stat sweep 5..30 at three levels follows the formulas exactly', () => {
    for (const lv of [1, 37, 99]) {
        for (let v = 5; v <= 30; v++) {
            const s = { str: v, vit: v, agi: 35 - v, dex: v, int: v, wis: 35 - v };
            assert.equal(hpOf(s, lv), 5 + Math.floor(lv / 3) + Math.floor(v / 2));
            assert.equal(mpOf(s, lv), 8 + Math.floor(lv / 4) + Math.floor(35 / 4));
            assert.equal(spOf(s, lv), 8 + Math.floor(lv / 4) + Math.floor(35 / 4));
        }
    }
});

test('stats clamp to 1..30, the level to 1..99, and junk reads as the minimum', () => {
    assert.equal(hpOf({ vit: 99 }, 150), hpOf({ vit: 30 }, 99));
    assert.equal(hpOf({ vit: -4 }, 0), 5 + 0 + 0);
    assert.equal(mpOf({}, 1), 8 + 0 + 0);
    assert.equal(spOf(undefined, 'x'), 8);
});
