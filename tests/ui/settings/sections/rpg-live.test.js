import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { selectSettings } from '../../../../ui/select/settings.js';

const live = selectSettings({ host: {}, schema: {}, defaults: {}, features: [], rpg: { rpgJoin: 'auto' } });

test('the live RPG page draws every row from the real view-model and a change reaches onChange with the row key', () => {
  const { page, calls } = mountSettings(live);
  const el = page('rpg');
  assert.equal(el.querySelectorAll('.sgrp .srow').length, live.sections.find(s => s.id === 'rpg').rows.length);
  assert.equal(el.querySelectorAll('.srow[data-key="rpg.setUpAFightFromMyAttack"] .sw').length, 1);
  el.querySelector('.srow[data-key="rpg.setUpAFightFromMyAttack"] .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'rpg.setUpAFightFromMyAttack', false]);
});
