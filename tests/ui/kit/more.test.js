import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { h } from '../../../ui/kit/dom.js';
import { moreList } from '../../../ui/kit/more.js';

const render = n => h('p', { class: 'row' }, `row ${n}`);

test('moreList shows the limit, then all, then fewer', () => {
  installFakeDom();
  const toggles = [];
  const el = moreList({ items: [1, 2, 3, 4, 5, 6, 7], render, limit: 5, onToggle: o => toggles.push(o) });
  assert.equal(el.querySelectorAll('.row').length, 5);
  const btn = el.querySelector('.more-btn');
  assert.equal(btn.textContent, 'Show all 7');
  btn.click();
  assert.equal(el.querySelectorAll('.row').length, 7);
  assert.equal(el.dataset.expanded, 'true');
  assert.equal(el.querySelector('.more-btn').textContent, 'Show fewer');
  el.querySelector('.more-btn').click();
  assert.equal(el.querySelectorAll('.row').length, 5);
  assert.deepEqual(toggles, [true, false]);
});

test('moreList has no button at or under the limit, and starts open when asked', () => {
  installFakeDom();
  const small = moreList({ items: [1, 2, 3, 4, 5], render });
  assert.equal(small.querySelectorAll('.row').length, 5);
  assert.equal(small.querySelector('.more-btn'), null);
  const empty = moreList({ items: [], render });
  assert.equal(empty.querySelectorAll('.row').length, 0);
  const open = moreList({ items: [1, 2, 3, 4, 5, 6], render, expanded: true, className: 'x' });
  assert.equal(open.querySelectorAll('.row').length, 6);
  assert.equal(open.classList.contains('x'), true);
});

test('moreList requires a render function', () => {
  installFakeDom();
  assert.throws(() => moreList({ items: [1] }), TypeError);
});
