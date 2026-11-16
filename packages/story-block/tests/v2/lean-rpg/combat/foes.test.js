// Combat Rules v1 foes: every cell of the tier table (HP / damage / roll bonus for 6 tiers at L1, 15, 30, 60, 99).

import test from 'node:test';
import assert from 'node:assert/strict';
import { foeMembers, foeStats } from '../../../../src/v2/lean-rpg/combat/foes.js';
import { RANKS, TEMPO_CAPS, TIERS, V1 } from '../../../../src/v2/lean-rpg/combat/numbers.js';

const LEVELS = [1, 15, 30, 60, 99];
const TABLE = {
    mob: ['2/1/+4', '3/1/+9', '5/2/+14', '9/3/+24', '14/5/+37'],
    minion: ['4/2/+5', '7/3/+10', '11/4/+15', '19/7/+25', '28/10/+38'],
    standard: ['8/3/+6', '15/5/+11', '23/8/+16', '38/13/+26', '57/19/+39'],
    elite: ['12/5/+7', '22/8/+12', '34/12/+17', '57/20/+27', '85/29/+40'],
    boss: ['16/6/+8', '30/10/+13', '46/16/+18', '76/26/+28', '114/38/+41'],
    apex: ['24/9/+10', '45/15/+15', '69/24/+20', '114/39/+30', '171/57/+43'],
};

for (const [tier, row] of Object.entries(TABLE)) {
    test(`${tier}: HP / damage / roll at every listed level`, () => {
        LEVELS.forEach((level, i) => {
            const f = foeStats({ level, tier });
            assert.equal(`${f.hp}/${f.damage}/+${f.roll}`, row[i], `${tier} L${level}`);
        });
    });
}

test('no tier, an unknown tier or a prototype name reads as standard', () => {
    for (const tier of [undefined, '', 'giant', 'constructor', '__proto__']) {
        assert.equal(foeStats({ level: 15, tier }).tier, 'standard');
    }
    assert.equal(foeStats().level, 1);
});

test('the tempo-side roll doubles the tier bonus only', () => {
    const t = tier => foeStats({ level: 30, tier }).tempoRoll;
    assert.deepEqual([t('mob'), t('minion'), t('standard'), t('elite'), t('boss'), t('apex')], [12, 14, 16, 18, 20, 24]);
});

test('damage rounds half up and HP rounds down', () => {
    assert.equal(foeStats({ level: 1, tier: 'mob' }).damage, 1);      // 0.75
    assert.equal(foeStats({ level: 1, tier: 'minion' }).damage, 2);   // 1.5
    assert.equal(foeStats({ level: 1, tier: 'elite' }).damage, 5);    // 4.5
    assert.equal(foeStats({ level: 15, tier: 'mob' }).hp, 3);         // 3.75
});

test('level sweep 1..99 matches the formulas for every tier', () => {
    for (let level = 1; level <= 99; level++) {
        for (const [tier, { mult, roll }] of Object.entries(TIERS)) {
            const f = foeStats({ level, tier });
            assert.equal(f.hp, Math.floor((8 + Math.floor(level / 2)) * mult));
            assert.equal(f.damage, Math.floor((3 + Math.floor(level / 6)) * mult + 0.5));
            assert.equal(f.roll, 6 + Math.floor(level / 3) + roll);
        }
    }
});

test('a group becomes numbered members at full HP', () => {
    const m = foeMembers({ name: 'Ridge hound', count: 3, level: 6, tier: 'minion' });
    assert.deepEqual(m.map(x => x.n), [1, 2, 3]);
    assert.ok(m.every(x => x.name === 'Ridge hound' && x.hp === x.maxHp && x.hp === 5 && x.damage === 2 && x.roll === 7));
    assert.equal(foeMembers({ level: 3, count: 0 }).length, 1);
    assert.equal(foeMembers({ name: 'Rat', count: 'x' }).length, 1);
});

test('the number tables are frozen and complete', () => {
    assert.ok(Object.isFrozen(V1) && Object.isFrozen(V1.foe) && Object.isFrozen(TIERS.mob) && Object.isFrozen(RANKS[0]));
    assert.deepEqual(Object.keys(TIERS), ['mob', 'minion', 'standard', 'elite', 'boss', 'apex']);
    assert.deepEqual(RANKS.map(r => r.mastery), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(RANKS.map(r => r.minLevel), [1, 1, 10, 25, 45, 65, 85]);
    assert.deepEqual(RANKS.map(r => r.practice), [0, 100, 200, 300, 400, 500, 600]);
    const cap = agi => TEMPO_CAPS.find(c => agi >= c.minAgi).cap;
    assert.deepEqual([1, 14, 15, 24, 25, 30].map(cap), [1, 1, 2, 2, 3, 3]);
    assert.equal(V1.die, 20);
    assert.equal(V1.soakCap, 50);
});
