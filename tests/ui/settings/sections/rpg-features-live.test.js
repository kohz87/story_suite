import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { selectSettings } from '../../../../ui/select/settings.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { INVENTORY_FEATURES } from '../../../../modules/inventory/state-parts/features.js';
import { CORE_FEATURES } from '../../../../modules/scene/domains/core/constants-parts/features.js';

const features = [...CORE_FEATURES, ...INVENTORY_FEATURES].map(f => ({ ...f, on: f.default !== false, moduleId: 'story-block', moduleName: 'Story Block' }));
const build = list => selectSettings({ host: {}, schema: {}, defaults: {}, features: list });
const KEYS = { 'rpg.pickWhatYouTake': 'story-block.loot', 'rpg.encumbered': 'story-block.encumbrance', 'rpg.gearInFights': 'story-block.gear' };

test('Pick what you take, Encumbered and Gear in fights are rows under RPG and fights and not on the Story Block card', () => {
  const vm = build(features);
  const rows = vm.sections.find(s => s.id === 'rpg').rows;
  for (const [key, id] of Object.entries(KEYS)) assert.equal(rows.find(r => r.key === key)?.type, 'sw', key);
  assert.deepEqual(rows.filter(r => KEYS[r.key]).map(r => r.label), ['Pick what you take', 'Encumbered', 'Gear in fights']);
  const card = vm.modules.defs.find(d => d.id === 'story-block');
  for (const id of Object.values(KEYS)) assert.equal(card.subs.some(s => s.key === id), false, id);
  assert.equal(Object.keys(vm.modules.chat['story-block'].subs).some(k => Object.values(KEYS).includes(k)), false);
  const before = build(features.filter(f => !Object.values(KEYS).includes(f.id)));
  assert.deepEqual(card.subs, before.modules.defs.find(d => d.id === 'story-block').subs, 'the card is the old card less those three');
});

test('the Mounts feature reads "Transport" on the card', () => {
  const card = build(features).modules.defs.find(d => d.id === 'story-block');
  assert.equal(card.subs.find(s => s.key === 'story-block.mounts')?.label, 'Transport');
  assert.equal(card.subs.some(s => /^mounts$/i.test(s.label)), false);
});

test('the rows draw on the live page and a switch reaches onChange with its row key', () => {
  const { page, calls } = mountSettings(build(features));
  const el = page('rpg');
  for (const key of Object.keys(KEYS)) assert.equal(el.querySelectorAll(`.srow[data-key="${key}"] .sw`).length, 1, key);
  el.querySelector('.srow[data-key="rpg.gearInFights"] .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'rpg.gearInFights', true]);
});

test('each row writes the same feature the card switch wrote, and the card master switch leaves them alone', async () => {
  const written = [];
  const writes = { features: { set: (id, on) => { written.push([id, on]); return on; } }, settings: { set: v => v, keep() {}, kept: () => null } };
  const port = createSbPort({ sdk: { features: () => features, settings: () => ({}) }, writes });
  for (const [key, id] of Object.entries(KEYS)) assert.equal((await port.command('settings.set', { key, value: true })).ok, true);
  assert.deepEqual(written, Object.entries(KEYS).map(([, id]) => [id, true]));
  written.length = 0;
  assert.equal((await port.command('settings.set', { key: 'rpg.encumbered', value: false })).value, false);
  assert.deepEqual(written, [['story-block.encumbrance', false]]);
  written.length = 0;
  await port.command('settings.set', { key: 'modules.chat.story-block', value: false });
  assert.equal(written.some(([id]) => Object.values(KEYS).includes(id)), false);
  assert.equal((await port.command('settings.set', { key: 'modules.chat.story-block.story-block.gear', value: true })).ok, false);
});
