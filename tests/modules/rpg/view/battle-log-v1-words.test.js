import test from 'node:test';
import assert from 'node:assert/strict';
import { barWord } from '../../../../modules/rpg/view/battle-log/bar-word.js';
import { readResolveV1 } from '../../../../modules/rpg/view/battle-log/read-v1.js';

test('a v1 numbers bar gets its stage word, so the log never tells an empty word', () => {
    assert.equal(barWord('health', { value: 0, max: 20, word: '', numbers: true }), 'Down');
    assert.equal(barWord('stamina', { value: 0, max: 12, word: '', numbers: true }), 'Empty');
    assert.ok(barWord('stamina', { value: 6, max: 12, word: '', numbers: true }).length > 0);
    assert.equal(barWord('health', { value: 3, max: 6, word: 'Hurt' }), 'Hurt', 'a bar with its own word keeps it');
    assert.equal(barWord('health', { value: 3, max: 6, word: '' }), '', 'a bar with neither says nothing');
});

const row = ['attack', 'Pell', 'normal', 'Raider', 10, 12, 10, 8, 'hit', 3, 0];
const record = first => ({ exchanges: 1, rounds: [[row]], party: [{ id: 'p', label: 'Pell' }], foes: [{ id: 'f', label: 'Raider' }], order: { first, party: ['p'], foes: ['f'] }, stop: 'open' });

test('the battle log turn order puts the side that won initiative first, as the board does', () => {
    assert.deepEqual(readResolveV1(record('foes')).order, ['Raider', 'Pell']);
    assert.deepEqual(readResolveV1(record('party')).order, ['Pell', 'Raider']);
});
