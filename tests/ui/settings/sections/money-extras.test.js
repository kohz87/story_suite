import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('Money has its Coins card and Reset but no module block', () => {
  const { page, sec } = mountSettings();
  const el = page('money');
  assert.equal(el.querySelector('.mod'), null);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('money').rows.length);
  assert.equal(el.querySelector('.sgrp .gt').textContent, 'Coins');
});

test('Chat extras leads with its module block, then lists its rows', () => {
  const { page, sec } = mountSettings();
  const el = page('extras');
  assert.equal(el.querySelectorAll('.mod[data-mod="extras"] .msubs .srow').length, 4);
  assert.ok(el.querySelector('.sgrp .gt'));
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('extras').rows.length);
});
