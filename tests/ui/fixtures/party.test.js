import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PARTY, partyFixture } from '../../../ui/fixtures/party.js';
import { BAG } from '../../../ui/fixtures/bag.js';

const member = id => PARTY.members.find(m => m.id === id);

describe('PARTY fixture', () => {
  it('has four members, Astra as the player, invite hidden at the cap of 4', () => {
    assert.equal(PARTY.pcId, 'astra');
    assert.deepEqual(PARTY.members.map(m => m.id), ['astra', 'brann', 'rika', 'torka']);
    assert.equal(PARTY.max, 4);
    assert.equal(PARTY.canInvite, false);
    assert.equal(partyFixture({ members: 2 }).canInvite, true);
    assert.equal(partyFixture({ members: 99 }).members.length, 4);
    assert.equal(partyFixture({ members: 0 }).members.length, 1);
  });

  it('matches the card: Astra 12/14 health, 14/14 mana, 12/15 stamina, soak 11%', () => {
    const astra = member('astra');
    assert.deepEqual(astra.bars.map(b => `${b.kind} ${b.value}/${b.max}`), ['hp 12/14', 'mp 14/14', 'sp 12/15']);
    assert.equal(astra.soakPct, 11);
    assert.equal(astra.points, 1);
    assert.equal(astra.level, 14);
  });

  it('computes soak from VIT plus gear points (Brann 17, Rika 8, Torka 13)', () => {
    assert.deepEqual(PARTY.members.map(m => m.soakPct), [11, 17, 8, 13]);
  });

  it('never has a stat below 5 (decision 39.3) and keeps WIS, not LUK', () => {
    for (const m of PARTY.members) {
      assert.deepEqual(Object.keys(m.stats), ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'WIS', 'CHA']);
      for (const v of Object.values(m.stats)) assert.ok(v >= 5);
    }
  });

  it('puts Rika away at the stables, still in the party', () => {
    assert.deepEqual(member('rika').away, { where: 'At the Bluewatch stables with the horses', lastSeen: '8:00 am' });
    assert.equal(member('astra').away, null);
  });

  it('gives every member the ten slots, with worn items that exist in the Bag', () => {
    for (const m of PARTY.members) {
      assert.equal(m.slots.length, 10);
      for (const s of m.slots.filter(x => x.item && x.key !== 'mount')) {
        const it = BAG.items.find(x => x.stack === s.item.stack);
        assert.ok(it, `${m.id} ${s.item.stack} missing from the Bag`);
        assert.equal(it.wornBy, m.id);
      }
    }
    assert.equal(member('astra').slots[6].item.torn, true);
    assert.equal(member('brann').slots[2].item, null);
  });

  it('puts the riding animals in the Mount slot and links them to Bag transport', () => {
    const ids = BAG.assets.transport.map(a => a.id);
    assert.ok(ids.includes(member('astra').slots[4].item.stack));
    assert.ok(ids.includes(member('rika').slots[4].item.stack));
    assert.equal(member('brann').slots[4].item, null);
  });

  it('lists skills with a mastery of 1 to 7 and Brann’s stance buff', () => {
    for (const m of PARTY.members) {
      for (const s of m.skills) assert.ok(s.mastery >= 1 && s.mastery <= 7);
    }
    assert.equal(member('astra').skills.length, 5);
    assert.equal(member('brann').effects[0].note, 'stance on · soak 22%');
    assert.equal(member('torka').effects.length, 0);
  });
});
