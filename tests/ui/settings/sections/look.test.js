import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('Look shows its five rows in one Skin card, the Follow note and one Reset; no module block', () => {
  const { page } = mountSettings();
  const el = page('look');
  assert.equal(el.querySelectorAll('.sgrp').length, 1);
  assert.equal(el.querySelectorAll('.srow').length, 5);
  assert.equal(el.querySelector('.mod'), null);
  assert.match(el.querySelector('.fine').textContent, /Follow SillyTavern/);
  assert.equal(el.querySelectorAll('.applies').length, 1);
  assert.equal(el.querySelectorAll('.btn2').filter(b => b.textContent === 'Reset Look to defaults').length, 1);
});

test('a skin choice goes through onChange with its key', () => {
  const { page, calls } = mountSettings();
  page('look').querySelector('.sseg2 button[data-value="Glass light"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'look.skin', 'Glass light']);
});
