import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';

test('Director opens with one module block, then every fixture row, and one note and one Reset', () => {
  const { page, sec } = mountSettings();
  const el = page('director');
  assert.equal(el.querySelectorAll('.mods .mod[data-mod="director"] .msubs').length, 1);
  assert.equal(el.querySelectorAll('.sgrp .srow').length, sec('director').rows.length);
  assert.equal(el.querySelectorAll('.applies').length, 1);
  assert.equal(el.querySelectorAll('.btn2').filter(b => /^Reset .* to defaults$/.test(b.textContent)).length, 1);
});

test('Director page switch changes the chat module set and reaches onChange', () => {
  const { page, calls } = mountSettings();
  page('director').querySelector('.mh .sw').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.director', false]);
  assert.equal(page('director').querySelector('.mod').className, 'mod off');
});
