import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, normalizeNpcRecord } from '../../modules/people/core/core.js';

const stored = extra => normalizeNpcRecord({ ...createNpcRecord('Mira', []), id: 'm', gender: 'female', lastSeenTurn: 1, ...extra });
const scan = (npc, row, turn = 2) => mergeScanResult({ npcs: [npc], candidates: [], turn, dismissed: [] }, { npcs: [{ name: 'Mira', present: true, ...row }] }, { turn, maxNpcs: 9 });

test('a story that contradicts a stored gender raises a warning and keeps the stored word', () => {
    const r = scan(stored(), { gender: 'male' });
    assert.equal(r.state.npcs[0].gender, 'female');
    assert.deepEqual(r.report.warnings, [{ id: 'm', name: 'Mira', kept: 'female', story: 'male', dead: false }]);
});

test('after death a stated gender is kept and the contradiction is warned about', () => {
    const r = scan(stored({ lifeState: 'deceased', lifeStateCertainty: 'explicit' }), { gender: 'male', genderState: 'correct', genderReason: 'x' });
    assert.equal(r.state.npcs[0].gender, 'female');
    assert.equal(r.report.warnings[0].dead, true);
});

test('no warning when the story agrees, states nothing, or a correction is accepted', () => {
    assert.deepEqual(scan(stored(), { gender: 'female' }).report.warnings, []);
    assert.deepEqual(scan(stored(), {}).report.warnings, []);
    const fixed = scan(stored(), { gender: 'male', genderState: 'correct', genderReason: 'the story says so' });
    assert.equal(fixed.state.npcs[0].gender, 'male');
    assert.deepEqual(fixed.report.warnings, []);
});
