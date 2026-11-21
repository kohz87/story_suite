import test from 'node:test';
import assert from 'node:assert/strict';
import { playerRoll } from '../../../../modules/rpg/combat/rolls.js';

// Owner, 20 Nov: evasion stays AGI ÷ 3, and a Speed stance gives its full mastery to evasion in a fight opened from now (speedFull), to match the Defence stance's soak; tempo keeps half.
test('a Speed stance adds its full mastery to evasion with speedFull, half without (older fights); tempo keeps half either way', () => {
    const stats = { agi: 16 };
    assert.equal(playerRoll('evasion', stats, 2, { mastery: 2, stance: 'speed', speedFull: true }), 5 + 2);
    assert.equal(playerRoll('evasion', stats, 2, { mastery: 2, stance: 'speed' }), 5 + 1, 'a fight opened before keeps the half');
    assert.equal(playerRoll('evasion', stats, 2, { mastery: 3, stance: 'speed', speedFull: true }), 5 + 3, 'Adept: +3');
    assert.equal(playerRoll('evasion', stats, 2, { mastery: 2, stance: 'defence', speedFull: true }), 5, 'no Speed stance, nothing added');
    assert.equal(playerRoll('tempo', stats, 2, { mastery: 2, stance: 'speed', speedFull: true }), 8 + 1, 'tempo keeps half');
});
