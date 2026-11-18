// The dossier's own feelings, stage words, goal and unstated gender (soak findings F21, F25, F16, F8): what the selector builds from the engine's answers.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDossier } from '../../../ui/select/dossier.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { checkShape } from '../../../ui/contract/shapes.js';

const DOSSIER = { id: 'np_h', name: 'Hesk', species: 'Human', gender: 'female', age: '41', present: true, lifeState: 'alive', goal: 'catch the Grey Ledger bribing her inspector',
  meters: { trust: 6, affection: 2, desire: 0, tension: 0, respect: 12 }, stages: { trust: 'Trusted ally', respect: 'Respected' } };
const CAST = { key: 'np_h', name: 'Hesk', rank: 'Confidant', bars: [
  { id: 'trust', label: 'Trust', value: 6, min: -100, max: 100, stage: 'Trusted ally' }, { id: 'affection', label: 'Affection', value: 2, min: -100, max: 100, stage: '' },
  { id: 'respect', label: 'Respect', value: 12, min: 0, max: 100, stage: 'Respected' }] };

describe('selectDossier: own feelings, stages, goal, gender line', () => {
  it('F21: a custom feeling comes with its label, range and stage; the four stay the four', () => {
    const vm = selectDossier({ dossier: DOSSIER, cast: CAST });
    assert.deepEqual(vm.extraMeters, [{ key: 'respect', label: 'Respect', value: 12, min: 0, max: 100, stage: 'Respected' }]);
    assert.deepEqual(Object.keys(vm.meters), ['trust', 'affection', 'desire', 'tension']);
    assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
  });

  it('F21: without the cast row the dossier\'s own numbers still show the feeling', () => {
    const vm = selectDossier({ dossier: DOSSIER });
    assert.deepEqual(vm.extraMeters, [{ key: 'respect', label: 'Respect', value: 12, min: -100, max: 100, stage: 'Respected' }]);
  });

  it('F21: nobody with only the four gets the extra keys at all', () => {
    const vm = selectDossier({ dossier: { ...DOSSIER, meters: { trust: 1, affection: 1, desire: 0, tension: 0 }, stages: {} }, cast: { key: 'np_h', bars: [] } });
    assert.equal(Object.hasOwn(vm, 'extraMeters'), false);
    assert.equal(Object.hasOwn(vm, 'axisStages'), false);
  });

  it('F25: a stage word per built-in feeling, and the rung from the cast row when npc.next has no answer', () => {
    const vm = selectDossier({ dossier: DOSSIER, cast: CAST });
    assert.deepEqual(vm.axisStages, { trust: 'Trusted ally' });
    assert.deepEqual(vm.stage, { now: 'Confidant', next: null, needs: null });
    assert.equal(selectDossier({ dossier: DOSSIER }).stage, null);
    assert.equal(selectDossier({ dossier: DOSSIER, cast: CAST, next: { rank: null, next: { name: 'Friend', needs: [] } } }).stage.now, 'Confidant');
  });

  it('F16: the goal is the Wants of the scene, with no Hiding; away or none gives no scene', () => {
    assert.deepEqual(selectDossier({ dossier: DOSSIER }).scene, { wants: 'catch the Grey Ledger bribing her inspector', hiding: null });
    assert.equal(selectDossier({ dossier: { ...DOSSIER, goal: '' } }).scene, null);
    assert.equal(selectDossier({ dossier: { ...DOSSIER, present: false } }).scene, null);
  });

  it('F8: an unstated gender is flagged by genderUnknown, not worded inside the line too', () => {
    const vm = selectDossier({ dossier: { ...DOSSIER, gender: '' } });
    assert.equal(vm.idLine, 'Human · 41');
    assert.equal(vm.genderUnknown, true);
    assert.equal(selectDossier({ dossier: { id: 'x', name: 'X', gender: '' } }).idLine, '');
  });
});
