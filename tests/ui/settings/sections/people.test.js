import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('People opens with one module block, then every fixture row, and one note and one Reset', () => {
  const { page, sec } = mountSettings();
  const el = page('people');
  assert.equal(el.querySelectorAll('.mods .mod[data-mod="people"] .msubs').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('people').rows.length);
  assert.equal(el.querySelectorAll('.applies').length, 1);
  assert.equal(el.querySelectorAll('.btn2').filter(b => /^Reset .* to defaults$/.test(b.textContent)).length, 1);
});

test('People page switch changes the chat module set and reaches onChange', () => {
  const { page, calls } = mountSettings();
  page('people').querySelector('.mh .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.people', false]);
  assert.equal(page('people').querySelector('.mod').className, 'mod off');
});
