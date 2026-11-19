// selectParty's Mount and Bag slots (gear.view's `ride` and `bagSlot`) and the pickers' lists (gear.view's `carriers.rides` / `packs`).
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { selectParty } from '../../../ui/select/party.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { checkShape } from '../../../ui/contract/shapes.js';

const ACTORS = [{ id: 'astra', name: 'Astra', pc: true }, { id: 'brann', name: 'Brann' }];
const CARRIERS = {
  mounts: [], bags: [],
  rides: [{ name: 'Grey Mare', kind: 'horse', pace: 35, count: 1, carry: 40, riders: ['Astra'], withParty: true, where: 'ridden by Astra' }],
  packs: [{ stack: 'it_sat', name: 'Satchel', carry: 10, owner: 'brann', by: 'Brann', bag: true, bound: '' }],
};
const GEAR = {
  astra: { on: true, slots: {}, carriers: CARRIERS, ride: { name: 'Grey Mare', kind: 'horse', pace: 35, carry: 40 }, bagSlot: null },
  brann: { on: true, slots: {}, carriers: CARRIERS, ride: null, bagSlot: { stack: 'it_sat', name: 'Satchel', carry: 10 } },
};

it('fills the Mount and Bag slots and the pickers\' lists, in the contract\'s shape', () => {
  const vm = selectParty({ actors: ACTORS, pc: { id: 'astra' }, levels: [], gear: GEAR });
  const slot = (member, key) => member.slots.find(entry => entry.key === key).item;
  const [astra, brann] = vm.members;
  assert.deepEqual(slot(astra, 'mount'), { stack: 'grey-mare', name: 'Grey Mare', rarity: 'common', soak: 0, torn: false, kind: 'horse', pace: 35, carry: 40 });
  assert.equal(slot(astra, 'bag'), null);
  assert.deepEqual(slot(brann, 'bag'), { stack: 'it_sat', name: 'Satchel', rarity: 'common', soak: 0, torn: false, carry: 10 });
  assert.equal(slot(brann, 'mount'), null);
  assert.deepEqual(vm.carriers.mounts[0].riders, ['Astra']);
  assert.deepEqual(vm.carriers.packs[0], CARRIERS.packs[0]);
  assert.deepEqual(checkShape(vm, PARTY_SHAPE, 'party').filter(problem => !/level|xpPct|points|soakPct|stats|line|portrait/.test(problem)), []);
});

it('no gear.view: no carriers, empty Mount and Bag slots', () => {
  const vm = selectParty({ actors: ACTORS, pc: { id: 'astra' }, levels: [], gear: {} });
  assert.equal('carriers' in vm, false);
  assert.equal(vm.members[0].slots.find(entry => entry.key === 'mount').item, null);
});
