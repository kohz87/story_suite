import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BAG, bagFixture } from '../../../ui/fixtures/bag.js';

const count = (vm, key) => vm.filters.find(f => f.key === key).count;

describe('BAG fixture', () => {
  it('shows 149 of 192 load, not heavy, on foot at 20 km/day', () => {
    assert.equal(BAG.load.value, 149);
    assert.equal(BAG.load.limit, 192);
    assert.equal(BAG.load.level, 'light');
    assert.equal(BAG.load.breakdown.reduce((t, p) => t + p.value, 0), 192);
    assert.deepEqual([BAG.pace.kmDay, BAG.pace.by, BAG.pace.slowed], [20, 'foot', false]);
  });

  it('keeps worn gear under Worn, not In bag, and counts each filter', () => {
    assert.equal(count(BAG, 'worn'), 22);
    assert.equal(count(BAG, 'all'), 12);
    assert.deepEqual(['gear', 'use', 'goods', 'material', 'quest'].map(k => count(BAG, k)), [2, 3, 3, 2, 2]);
    assert.equal(BAG.items.filter(i => i.wornBy).length, 22);
  });

  it('gives every item a unique stack id (the two Hob boots differ)', () => {
    const stacks = BAG.items.map(i => i.stack);
    assert.equal(new Set(stacks).size, stacks.length);
    assert.ok(stacks.includes('hob-boots-brann') && stacks.includes('hob-boots-torka'));
  });

  it('marks new items and the torn shield, and carries only soak as a gear bonus', () => {
    assert.deepEqual(BAG.items.filter(i => i.isNew).map(i => i.name), ['Healing draught', 'Sealed letter']);
    assert.equal(BAG.items.find(i => i.stack === 'oak-round-shield').wear, 'torn');
    assert.equal(BAG.items.find(i => i.stack === 'chain-shirt').soak, 2);
    assert.equal(BAG.items.find(i => i.stack === 'healing-draught').wear, null);
  });

  it('has the purse with this turn’s two lines', () => {
    assert.equal(BAG.purse.words, '2 gold 14 silver 6 copper');
    assert.deepEqual(BAG.purse.thisTurn.map(t => [t.delta, t.up]), [['−8 copper', false], ['+1 silver', true]]);
  });

  it('lists four transports (cart parked, not with the party) and two properties', () => {
    assert.deepEqual(BAG.assets.transport.map(a => a.id), ['dappled-mare', 'grey-pony', 'covered-cart', 'rowboat']);
    assert.deepEqual(BAG.assets.transport.map(a => a.withParty), [true, true, false, false]);
    assert.equal(BAG.assets.transport[2].seats, 2);
    assert.equal(BAG.assets.property.length, 2);
    assert.equal(BAG.assets.property[0].seats, null);
  });

  it('over variant adds the anvil, goes over the limit and slows the party to 15 km/day', () => {
    const over = bagFixture({ over: true });
    assert.equal(over.load.value, 199);
    assert.equal(over.load.level, 'over');
    assert.deepEqual([over.pace.kmDay, over.pace.slowed], [15, true]);
    assert.equal(over.items.length, BAG.items.length + 1);
    assert.equal(bagFixture().items.length, BAG.items.length);
  });

  it('story-only variant has no load, rarity, wear or weight, but keeps the pace source', () => {
    const off = bagFixture({ rpg: false });
    assert.equal(off.rpg, false);
    assert.equal(off.load, null);
    assert.ok(off.items.every(i => i.rarity === 'common' && i.wear === null && i.weight === 0 && i.soak === 0));
    assert.equal(off.pace.kmDay, 20);
    assert.ok(off.assets.transport.every(a => a.condition === null));
    assert.equal(count(off, 'worn'), 22);
  });
});
