import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectBag } from '../../../ui/select/bag.js';
import { BAG_SHAPE } from '../../../ui/contract/bag.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// inventory.items rows: packages/story-block/src/v2/domains/inventory/queries.js:42-63.
const row = (o) => ({ stack: 's', def: 'd', name: 'Thing', kind: 'goods', rarity: 'common', value: 5, slot: null, qty: 1, owner: 'party', equipped: null, note: '', from: '', ...o });
const ITEMS = [
  row({ stack: 'sw', name: 'Steel longsword', kind: 'equipment', rarity: 'rare', value: 120, equipped: 'weapon', owner: 'astra', from: 'Saltmarsh ruin' }),
  row({ stack: 'sh', name: 'Oak round shield', kind: 'equipment', rarity: 'uncommon', value: 1, equipped: 'off-hand', owner: 'party' }),
  row({ stack: 'dg', name: 'Spare dagger', kind: 'equipment', value: 8 }),
  row({ stack: 'hd', name: 'Healing draught', kind: 'consumable', qty: 3, value: 2 }),
  row({ stack: 'fish', name: 'Salted fish', kind: 'goods', qty: 6 }),
  row({ stack: 'ore', name: 'Iron ore', kind: 'material', rarity: 'legendary' }),
  row({ stack: 'lt', name: 'Sealed letter', kind: 'quest', value: 0 }),
  row({ stack: 'coin', name: 'Marks', kind: 'money', qty: 40 }),
];
// gear.view: views.js:93-110 (rows by stack with condition word) and :133-139 (carry; level normal | heavy | over).
const GEAR = {
  rows: { sw: { word: 'good' }, sh: { word: 'torn' }, dg: { word: 'worn' }, hd: { word: 'good' } },
  carry: { load: 31, capacity: 70, pct: 44, level: 'normal', lose: 2, breakdown: 'Strength 25 · Horse +40', away: [] },
};
// inventory.wallet answers.js:63 ({ coin: n }); inventory.currency :32 ({ name, plural, short }); mounts.list mounts.js:83-91; mounts.pace :98-105.
const BASE = {
  rpg: true, items: ITEMS, gear: GEAR, wallet: { coin: 40 }, currency: { name: 'mark', plural: 'marks', short: 'm' },
  mounts: [{ name: 'Dappled mare', kind: 'horse', count: 1, pace: 35, condition: 'rested', where: '' }, { name: 'Covered cart', kind: 'cart', count: 1, pace: 15, condition: '', where: 'Parked at the stables' }],
  pace: { pace: 15, mounts: 2, riders: 4, short: 2, slowest: 'Covered cart' }, pcId: 'astra',
};

describe('selectBag', () => {
  const vm = selectBag(BASE);

  it('maps kinds, drops money, folds legendary to epic and keeps stacks in order', () => {
    assert.deepEqual(vm.items.map(i => [i.stack, i.kind]), [['sw', 'gear'], ['sh', 'gear'], ['dg', 'gear'], ['hd', 'use'], ['fish', 'goods'], ['ore', 'material'], ['lt', 'quest']]);
    assert.equal(vm.items.find(i => i.stack === 'ore').rarity, 'epic');
    assert.equal(vm.items.find(i => i.stack === 'hd').qty, 3);
  });

  it('names the wearer by id, and the party-owned worn piece by the pc', () => {
    const by = Object.fromEntries(vm.items.map(i => [i.stack, i.wornBy]));
    assert.equal(by.sw, 'astra');
    assert.equal(by.sh, 'astra');
    assert.equal(by.dg, null);
    assert.equal(by.hd, null);
  });

  it('turns the condition word into good or torn, only for gear', () => {
    const by = Object.fromEntries(vm.items.map(i => [i.stack, i.wear]));
    assert.deepEqual([by.sw, by.sh, by.dg, by.hd, by.fish], ['good', 'torn', 'good', null, null]);
  });

  it('writes worth in the chat currency with the right plural', () => {
    const by = Object.fromEntries(vm.items.map(i => [i.stack, i.worth]));
    assert.equal(by.sw, '120 marks');
    assert.equal(by.sh, '1 mark');
    assert.equal(selectBag({ ...BASE, currency: undefined }).items[0].worth, '120 coins');
  });

  it('counts the filters over the shown items', () => {
    assert.deepEqual(Object.fromEntries(vm.filters.map(f => [f.key, f.count])), { all: 7, worn: 2, gear: 3, use: 1, goods: 1, material: 1, quest: 1 });
  });

  it('returns weight, desc, isNew, soak as null (gaps) and the purse split as null', () => {
    assert.deepEqual([vm.items[0].weight, vm.items[0].desc, vm.items[0].isNew, vm.items[0].soak], [null, null, null, null]);
    assert.equal(vm.purse.coins, null);
    assert.equal(vm.purse.words, '40 marks');
    assert.equal(vm.purse.rates, null);
    assert.deepEqual(vm.purse.thisTurn, []);
  });

  it('builds load from the carry answer, light for normal, and null without one', () => {
    assert.deepEqual(vm.load, { value: 31, limit: 70, level: 'light', breakdown: [] });
    assert.equal(selectBag({ ...BASE, gear: { rows: {} } }).load, null);
    assert.equal(selectBag({ ...BASE, gear: null }).load, null);
    assert.equal(selectBag({ ...BASE, gear: { carry: { ...GEAR.carry, level: 'over' } } }).load.level, 'over');
  });

  it('builds pace and transport from the mount answers; property stays empty', () => {
    assert.deepEqual(vm.pace, { kmDay: 15, by: 'Covered cart', slowed: true, why: '', alt: '' });
    assert.deepEqual(vm.assets.transport.map(a => [a.id, a.glyph, a.withParty, a.seats, a.condition]), [['dappled-mare', 'mount', true, null, 'rested'], ['covered-cart', 'cart', null, null, null]]);
    assert.deepEqual(vm.assets.property, []);
    const none = selectBag({ ...BASE, mounts: null, pace: null });
    assert.equal(none.pace, null);
    assert.deepEqual(none.assets.transport, []);
  });

  it('matches BAG_SHAPE except the named gaps', () => {
    const errors = checkShape(vm, BAG_SHAPE);
    const allowed = /(weight|soak|desc|isNew|seats|withParty|coins|rates)\b|purse\.coins|purse\.rates|got null/;
    assert.ok(errors.every(e => allowed.test(e)), errors.join('\n'));
  });

  it('returns null with no inventory answer, and reports rpg off', () => {
    assert.equal(selectBag({}), null);
    assert.equal(selectBag({ items: null }), null);
    assert.equal(selectBag({ ...BASE, rpg: false }).rpg, false);
    assert.deepEqual(selectBag({ items: [] }).items, []);
  });
});
