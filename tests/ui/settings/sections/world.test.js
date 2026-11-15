import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('World opens with one module block, then every fixture row, and one note and one Reset', () => {
  const { page, sec } = mountSettings();
  const el = page('world');
  assert.equal(el.querySelectorAll('.mods .mod[data-mod="world"] .msubs').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('world').rows.length);
  assert.equal(el.querySelectorAll('.applies').length, 1);
  assert.equal(el.querySelectorAll('.btn2').filter(b => /^Reset .* to defaults$/.test(b.textContent)).length, 1);
});

test('World page switch changes the chat module set and reaches onChange', () => {
  const { page, calls } = mountSettings();
  page('world').querySelector('.mh .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.world', false]);
  assert.equal(page('world').querySelector('.mod').className, 'mod off');
});
