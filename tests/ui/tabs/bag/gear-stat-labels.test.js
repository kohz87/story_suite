// The names a reader sees for the gear's stats: Text RPG's (WIS in the gear's LUK place) while it answers `gear.statLabels`, the gear's own otherwise; stored data keeps the gear's keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { bagTab } from '../../../../ui/tabs/bag/bag.js';
import { statsPicker, statsLine } from '../../../../ui/tabs/bag/gear-stats.js';
import { labelsOf, relabel } from '../../../../ui/select/stat-labels.js';
import { selectBag } from '../../../../ui/select/bag.js';
import { selectParty } from '../../../../ui/select/party.js';
import { makeCtx } from './helpers.js';

const TEXT_RPG = ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA'];
const OWN = ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'LUK', 'CHA'];
const flush = () => new Promise(resolve => setImmediate(resolve));
const shown = form => form.querySelectorAll('.ps-st b').map(b => b.textContent);
const openAdd = gear => {
  const ctx = makeCtx();
  bagTab({ ...bagFixture(), gear }, ctx).querySelectorAll('.ihead .btn2').find(b => b.textContent === '+ Add').click();
  const form = ctx.sheets[0][0];
  const kind = form.querySelector('select');
  kind.value = 'equipment';
  kind.dispatch('change');
  return [form, ctx];
};

test('relabel and labelsOf: positions, the gear\'s own names for anything but seven words, and text left alone when nothing changes', () => {
  assert.equal(relabel('+1 LUK +2 STR', labelsOf(TEXT_RPG)), '+1 WIS +2 STR');
  assert.equal(relabel('+1 LUK', labelsOf(OWN)), '+1 LUK');
  assert.equal(relabel('+1 LUK', labelsOf(['A', 'B', 'C', 'D', 'E', 'LUK', 'LUK'])), '+1 LUK', 'one pass: a label is never swapped again');
  assert.equal(labelsOf(null), null);
  assert.equal(labelsOf(['a', 'b']), null);
  assert.equal(labelsOf(OWN), null, 'the gear\'s own names need no labels');
  assert.deepEqual(labelsOf(TEXT_RPG), TEXT_RPG);
});

test('the Stats picker with Text RPG\'s names offers WIS (the LUK place) always; the points stay on the gear\'s LUK key; with the gear\'s own names LUK shows only on a piece that has it', () => {
  installFakeDom();
  const picker = statsPicker({ budget: 2, labels: TEXT_RPG });
  assert.deepEqual(shown(picker.el), ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'WIS', 'CHA']);
  assert.equal(picker.el.querySelector('[data-stat="LUK"] small').textContent, 'Wisdom');
  picker.el.querySelector('[data-plus="LUK"]').click();
  assert.deepEqual(picker.value(), { LUK: 1 }, 'stored under LUK');
  assert.equal(statsLine({ LUK: 1, DEX: 1 }, TEXT_RPG), '+1 DEX · +1 WIS');
  assert.deepEqual(shown(statsPicker({ budget: 1, labels: OWN }).el), ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'CHA']);
});

test('+ Add form: WIS with Text RPG\'s names, LUK-free default list without them; a renamed stat shows on the picker', async () => {
  installFakeDom();
  const [on] = openAdd({ on: true, kit: true, labels: TEXT_RPG });
  assert.ok(shown(on).includes('WIS'));
  assert.ok(!shown(on).includes('LUK'));
  const [off] = openAdd({ on: true, kit: true, labels: OWN });
  assert.ok(!shown(off).includes('WIS'));
  assert.ok(!shown(off).includes('LUK'), 'no points on LUK: not offered');
  const [renamed, ctx] = openAdd({ on: true, kit: true, labels: ['Might', 'VIT', 'AGI', 'DEX', 'INT', 'Spirit', 'CHA'] });
  assert.ok(shown(renamed).includes('Spirit') && shown(renamed).includes('Might'));
  renamed.querySelector('input').value = 'Charm';
  renamed.querySelector('input').dispatch('input');
  renamed.querySelector('[data-minus="CHA"]')?.click();
  renamed.querySelector('[data-plus="LUK"]').click();
  renamed.querySelector('.save').click();
  await flush();
  assert.equal(ctx.sent[0][1].stats?.LUK, 1, 'the add carries the gear\'s key');
});

test('the Bag and Party view-models word a bonus with the labels, and keep the picker\'s labels on the item and the form', () => {
  const items = [{ stack: 'c', def: 'd', name: 'Clover charm', kind: 'equipment', rarity: 'common', value: 1, slot: 'head', qty: 1, owner: 'party', equipped: 'head', note: '', from: '' }];
  const gear = { rows: { c: { word: 'good', bonus: '+1 LUK', repoint: { budget: 1, stats: { LUK: 1 } } } } };
  const vm = selectBag({ rpg: true, items, gear, pcId: 'astra', labels: TEXT_RPG });
  assert.equal(vm.items[0].bonus, '+1 WIS');
  assert.deepEqual(vm.items[0].repoint, { budget: 1, stats: { LUK: 1 }, labels: TEXT_RPG });
  assert.deepEqual(vm.gear.labels, TEXT_RPG);
  assert.equal(selectBag({ rpg: true, items, gear, pcId: 'astra' }).items[0].bonus, '+1 LUK', 'no labels: the gear\'s own');
  const party = selectParty({ actors: [{ id: 'astra', name: 'Astra' }], gear: { astra: { slots: { head: { stack: 'c', name: 'Clover charm', rarity: 'common', bonus: '+1 LUK' } } } }, labels: TEXT_RPG });
  assert.equal(party.members[0].slots.find(slot => slot.key === 'head').item.bonus, '+1 WIS');
});
