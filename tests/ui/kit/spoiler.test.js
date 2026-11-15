import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { spoilerSwitch, hiddenValue } from '../../../ui/kit/spoiler.js';

test('spoilerSwitch renders title, hint and a labelled switch that reports changes', () => {
  installFakeDom();
  const seen = [];
  const row = spoilerSwitch({ id: 'a', title: 'Scene spoilers', hint: 'per chat', onChange: v => seen.push(v) });
  assert.equal(row.querySelector('.t').textContent, 'Scene spoilersper chat');
  const sw = row.querySelector('[role="switch"]');
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  assert.equal(sw.getAttribute('aria-labelledby'), 'a-label');
  assert.equal(row.querySelector('#a-label') !== null, true);
  sw.click();
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  sw.click();
  assert.deepEqual(seen, [true, false]);
});

test('spoilerSwitch starts checked and works without a hint or handler', () => {
  installFakeDom();
  const row = spoilerSwitch({ title: 'T', checked: true });
  assert.equal(row.querySelector('[role="switch"]').getAttribute('aria-checked'), 'true');
  assert.equal(row.querySelector('small'), null);
  row.querySelector('[role="switch"]').click();
});

test('hiddenValue never leaks the text while hidden', () => {
  installFakeDom();
  const hidden = hiddenValue('secret plan', false, 'Hidden · switch on');
  assert.equal(hidden.textContent, 'Hidden · switch on');
  assert.equal(hidden.classList.contains('hid'), true);
  assert.equal(hiddenValue('secret plan', false).textContent, 'Hidden');
  const shown = hiddenValue('secret plan', true);
  assert.equal(shown.textContent, 'secret plan');
  assert.equal(hiddenValue(null, true).textContent, '');
});
