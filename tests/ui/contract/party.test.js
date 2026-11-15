import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { partyFixture } from '../../../ui/fixtures/party.js';

describe('PARTY_SHAPE', () => {
  it('accepts the fixture, a solo party and a full party', () => {
    assert.deepEqual(checkShape(partyFixture(), PARTY_SHAPE), []);
    assert.deepEqual(checkShape(partyFixture({ members: 1 }), PARTY_SHAPE), []);
  });

  it('rejects a bad slot key, a missing stat, a bad rank and an away without lastSeen', () => {
    const vm = partyFixture();
    vm.members[0].slots[0].key = 'hat';
    delete vm.members[1].stats.WIS;
    vm.members[1].skills[0].rank = 'Beginner';
    vm.members[2].away = { where: 'stables' };
    assert.deepEqual(checkShape(vm, PARTY_SHAPE), [
      'members[0].slots[0].key: expected one of [head, armor, cloak, feet, mount, weapon, offhand, accessory1, accessory2, bag], got "hat"',
      'members[1].stats.WIS: expected number, got undefined',
      'members[1].skills[0].rank: expected one of [Novice, Apprentice, Adept, Expert, Master, Grandmaster, Legend], got "Beginner"',
      'members[2].away.lastSeen: expected string, got undefined',
    ]);
  });
});
