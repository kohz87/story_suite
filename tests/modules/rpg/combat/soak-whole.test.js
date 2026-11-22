import test from 'node:test';
import assert from 'node:assert/strict';
import { takeHit } from '../../../../modules/rpg/combat/damage.js';
import { playExchange } from '../../../../modules/rpg/combat/exchange.js';

// Owner, 22 Nov: soak takes off only the whole points it adds up to (raw − ⌊raw × soak%⌋) in a fight opened from now (soakWhole); a fight opened before
// rounds the damage left down, as it did (3 damage through 6% soak was 2).
test('soakWhole: soak takes off only whole points; without it (older fights) the damage left is rounded down', () => {
    assert.equal(takeHit(3, 6, false, true), 3, '0.18 of a point is not a point');
    assert.equal(takeHit(3, 6), 2, 'a fight opened before keeps 2');
    assert.equal(takeHit(17, 6, false, true), 16, 'from 17 damage, 6% takes one');
    assert.equal(takeHit(9, 50, false, true), 5, '4.5 off is 4');
    assert.equal(takeHit(10, 50, false, true), 5);
    assert.equal(takeHit(3, 50, true, true), 2, 'decisive 4, 2 off');
    assert.equal(takeHit(1, 50, false, true), 1, 'at least one');
    assert.equal(takeHit(10, 90, false, true), 5, 'soak capped at 50');
    for (let raw = 1; raw <= 60; raw++) {
        for (let soak = 0; soak <= 50; soak++) {
            const whole = takeHit(raw, soak, false, true), old = takeHit(raw, soak);
            assert.ok(whole >= old && whole - old <= 1, `raw ${raw}, soak ${soak}: never less than before, at most one more`);
            assert.equal(whole, Math.max(1, raw - Math.floor(raw * soak / 100)));
        }
    }
});

test('in a fight with soakWhole a foe\'s 4-damage hit through 6% soak deals 4; without it (a fight opened before) 3', () => {
    const run = soakWhole => playExchange({ party: [{ id: 'Ace', label: 'Ace', hp: 30, maxHp: 30, level: 1, stats: { vit: 6, agi: 1, dex: 1, str: 1 } }], foes: [{ label: 'boar', tier: 'standard', level: 1, hp: 50, maxHp: 50, damage: 3, roll: 10 }] },
        {}, { order: { party: ['Ace'], foes: ['boar'], first: 'foes' }, roll: () => 15, number: 1, rotation: 0, ...(soakWhole ? { soakWhole: true } : {}) });
    const hitOf = out => out.lines.find(line => line[0] === 'foe-attack');
    const now = hitOf(run(true)), before = hitOf(run(false));
    assert.equal(now[8], 6, 'soak 6%');
    assert.equal(now[7], before[7], 'the same roll');
    assert.equal(now[9] - before[9], 1, JSON.stringify({ now, before }));
});
