import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { selectSettings } from '../../../../ui/select/settings.js';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';
import { rpgCommand } from '../../../../ui/port/rpg.js';

const live = selectSettings({ host: {}, schema: {}, defaults: {}, features: [], rpg: { rpgJoin: 'auto' } });

test('the live RPG page draws every row from the real view-model and a change reaches onChange with the row key', () => {
  const { page, calls } = mountSettings(live);
  const el = page('rpg');
  assert.equal(el.querySelectorAll('.sgrp .srow').length, live.sections.find(s => s.id === 'rpg').rows.length);
  assert.equal(el.querySelectorAll('.srow[data-key="rpg.setUpAFightFromMyAttack"] .sw').length, 1);
  el.querySelector('.srow[data-key="rpg.setUpAFightFromMyAttack"] .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'rpg.setUpAFightFromMyAttack', false]);
});

test('the live RPG page at Custom draws the four Custom editors after Difficulty, and a typed number reaches onChange with its key', () => {
  const custom = selectSettings({ host: {}, schema: {}, defaults: {}, features: [], rpg: { rpgDifficulty: 'custom', rpgStandard: { startStat: 4, createMin: 3 } } });
  const { page, calls } = mountSettings(custom);
  const el = page('rpg');
  const keys = el.querySelectorAll('.sgrp .srow').map(r => r.dataset.key);
  assert.deepEqual(keys.slice(0, 5), ['rpg.difficulty', 'rpg.custom.startStat', 'rpg.custom.createPoints', 'rpg.custom.createMin', 'rpg.custom.createMax']);
  assert.match(el.querySelector('.srow[data-key="rpg.difficulty"] .lb small').textContent, /^Your numbers: stats start at 4, 10 points to spend, each stat 3 to 10$/);
  const input = el.querySelector('.srow[data-key="rpg.custom.createPoints"] input');
  input.value = '14';
  input.dispatch('change');
  assert.deepEqual(calls.at(-1), ['c', 'rpg.custom.createPoints', 14]);
});

test('choosing Custom on the live page draws its editors at once, and a refused number shows why and goes back to the stored one', async () => {
  const doc = installFakeDom();
  const bucket = {};
  const writes = { settings: { set: (_id, key, value) => { bucket[key] = value; return value; } } };
  const read = () => selectSettings({ host: {}, schema: {}, defaults: {}, features: [], rpg: bucket });
  const ov = createSettingsOverlay({ doc, settings: read(), renderSection: renderSettingsSection, onView: name => (name === 'settings' ? read() : null),
    onChange: async (key, value) => rpgCommand('settings.set', { key, value }, writes, () => bucket), onAction: () => null });
  ov.open('rpg');
  const page = () => ov.el.querySelector('.spage');
  const keys = () => page().querySelectorAll('.srow').map(r => r.dataset.key).filter(k => k.startsWith('rpg.custom.'));
  assert.deepEqual(keys(), []);
  page().querySelectorAll('.srow[data-key="rpg.difficulty"] .ctl button').find(b => b.textContent === 'Custom').click();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(keys().length, 4);
  assert.equal(page().querySelector('.diff-line.on').dataset.diff, 'custom');
  assert.match(page().querySelector('.srow[data-key="rpg.difficulty"] .lb small').textContent, /^Your numbers:/);
  // As a browser does on Tab: the field loses focus, its change fires (and its promise jobs run), then the next field gets the focus.
  const input = page().querySelector('.srow[data-key="rpg.custom.createMin"] input'), next = page().querySelector('.srow[data-key="rpg.custom.createMax"] input');
  input.value = '9';
  doc.activeElement = null;
  input.dispatch('change');
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  next.focus();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.match(page().querySelector('.custom-refused').textContent, /lowest ≤ stats start at ≤ highest/);
  assert.equal(page().querySelector('.srow[data-key="rpg.custom.createMin"] input').value, '5');
  assert.equal(bucket.rpgStandard.createMin, 5);
  assert.ok(doc.activeElement === page().querySelector('.srow[data-key="rpg.custom.createMax"] input'), 'the field tabbed to keeps the focus after the page draws again');
});
