import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { cardRow } from '../../../ui/card/card-row.js';
import { fixture } from '../../../ui/fixtures/index.js';

test('cardRow shows ‹ Chat, time and date, place, weather and the settings gear', () => {
  installFakeDom();
  const row = cardRow(fixture('default').card.scene);
  assert.equal(row.className, 'ctop');
  assert.equal(row.querySelector('.bk').textContent, '‹ Chat');
  const text = row.querySelector('.meta').textContent;
  assert.match(text, /9:30 am · Goldwane 13, Fourthday/);
  assert.match(text, /Guild Office, Bluewatch/);
  assert.match(text, /cold drizzle, chilly/);
  assert.equal(row.querySelector('.ibtn').textContent, '⚙');
});

test('cardRow wires the three handlers', () => {
  installFakeDom();
  const seen = [];
  const row = cardRow({ time: '9:30 am', place: 'Inn' }, {
    onBack: () => seen.push('back'),
    onScene: () => seen.push('scene'),
    onSettings: () => seen.push('settings'),
  });
  row.querySelector('.bk').click();
  row.querySelector('.meta').click();
  row.querySelector('.ibtn').click();
  assert.deepEqual(seen, ['back', 'scene', 'settings']);
});

test('the scene area is a keyboard-reachable dialog opener', () => {
  installFakeDom();
  const seen = [];
  const row = cardRow({ time: '1 pm' }, { onScene: () => seen.push('scene') });
  const meta = row.querySelector('.meta');
  assert.equal(meta.getAttribute('role'), 'button');
  assert.equal(meta.getAttribute('tabindex'), '0');
  assert.equal(meta.getAttribute('aria-haspopup'), 'dialog');
  meta.dispatch('keydown', { key: 'Enter' });
  meta.dispatch('keydown', { key: 'x' });
  assert.deepEqual(seen, ['scene']);
});

test('cardRow leaves out missing parts and tolerates no arguments', () => {
  installFakeDom();
  const row = cardRow({ time: '1 pm', place: null, weather: null });
  assert.equal(row.querySelector('.meta').children.length, 1);
  assert.equal(row.querySelector('.meta').textContent, '1 pm');
  const bare = cardRow();
  assert.equal(bare.querySelector('.meta').children.length, 0);
  bare.querySelector('.bk').click();
  bare.querySelector('.meta').click();
});

test('cardRow treats scene text as text, not markup', () => {
  installFakeDom();
  const row = cardRow({ time: '1 pm', place: '<img src=x>' });
  assert.equal(row.querySelectorAll('img').length, 0);
  assert.match(row.textContent, /<img src=x>/);
});
