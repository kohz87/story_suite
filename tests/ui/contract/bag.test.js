import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../ui/contract/bag.js';
import { bagFixture } from '../../../ui/fixtures/bag.js';

describe('BAG_SHAPE', () => {
  it('accepts the default, story-only and over-the-limit variants', () => {
    for (const opts of [{}, { rpg: false }, { over: true }]) {
      assert.deepEqual(checkShape(bagFixture(opts), BAG_SHAPE), []);
    }
  });

  it('rejects a bad item kind, a bad load level and a missing purse coin', () => {
    const vm = bagFixture();
    vm.items[0].kind = 'junk';
    vm.load.level = 'crushing';
    delete vm.purse.coins.copper;
    assert.deepEqual(checkShape(vm, BAG_SHAPE), [
      'items[0].kind: expected one of [gear, use, goods, material, quest], got "junk"',
      'purse.coins.copper: expected number, got undefined',
      'load.level: expected one of [light, heavy, over], got "crushing"',
    ]);
  });
});
