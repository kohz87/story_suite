import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { FIGHT_SHAPE } from '../../../ui/contract/fight.js';
import { FIGHT_STATES, fightFixture } from '../../../ui/fixtures/fight.js';

describe('FIGHT_SHAPE', () => {
  it('accepts every board state, also with the wide worst-case foes', () => {
    for (const state of FIGHT_STATES) {
      assert.deepEqual(checkShape(fightFixture(state), FIGHT_SHAPE), [], state);
      assert.deepEqual(checkShape(fightFixture(state, { wide: true }), FIGHT_SHAPE), [], state);
    }
  });

  it('rejects a bad state, a bad tier, a bad odds word and a bad outcome', () => {
    const vm = fightFixture('end');
    vm.state = 'idle';
    vm.foeGroups[0].tier = 'Legend';
    vm.foeGroups[0].odds.word = 'certain';
    vm.end.outcome = 'drew';
    assert.deepEqual(checkShape(vm, FIGHT_SHAPE), [
      'state: expected one of [offer, choose, target, ally, after, end], got "idle"',
      'foeGroups[0].tier: expected one of [Mob, Minion, Standard, Elite, Boss, Apex], got "Legend"',
      'foeGroups[0].odds.word: expected one of [likely, even, long shot], got "certain"',
      'end.outcome: expected one of [won, fled, lost], got "drew"',
    ]);
  });
});
