import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPacks } from '../../../ui/select/packs.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';

const LIST = [{ id: 'ersveil', name: 'Ersveil (open world)', version: '2.9.6', author: 'Raven', enabled: true, counts: { places: 320, cast: 12 }, hasStart: false, extras: [], missing: [], problem: '' }];
const SETUP = [
  { module: 'favour', packId: 'ersveil', definition: { name: 'Court favour', state: {} }, pinned: true, status: 'Enabled' },
  { module: 'guild', packId: 'ersveil', definition: { name: 'Guild membership', state: {} }, pinned: false, available: true, status: 'Ready' },
  { module: 'debt', packId: 'chat', pinned: true, definition: { name: 'Chapel debt', state: { a: {}, b: {}, c: {} }, show: { card: true } } },
];

test('the installed packs, the pack data modules and the chat\'s trackers come from the live answers', () => {
  const vm = selectPacks({ list: LIST, setup: SETUP });
  assert.deepEqual(vm.packs, [{ id: 'ersveil', name: 'Ersveil (open world) 2.9.6', desc: '320 places, 12 cast members · by Raven', on: true }]);
  assert.deepEqual(vm.modules.map(m => [m.id, m.on, m.locked]), [['favour', true, true], ['guild', false, false]]);
  assert.deepEqual(vm.trackers.items, [{ id: 'favour', name: 'Court favour', desc: '0 fields' }, { id: 'debt', name: 'Chapel debt', desc: '3 fields · shown on Now' }]);
  assert.equal(vm.trackers.cap, 28);
});

test('a pack that cannot be used says why, and no answers give an empty page', () => {
  assert.match(selectPacks({ list: [{ ...LIST[0], problem: 'Too new', enabled: false }] }).packs[0].desc, /Not usable: Too new/);
  assert.deepEqual(selectPacks(null), { packs: [], modules: [], trackers: { cap: 28, items: [] } });
});

test('Settings has a Packs and trackers section under Setup and carries the page to the contract shape', () => {
  const vm = selectSettings({ features: [], packsAnswers: { list: LIST, setup: SETUP } });
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  const sec = vm.sections.find(s => s.id === 'packs');
  assert.deepEqual([sec.group, sec.name, sec.special], ['Setup', 'Packs and trackers', 'packs']);
  assert.equal(vm.packs.packs.length, 1);
});
