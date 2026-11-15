import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { pager, pageSection, kvList } from '../../../ui/kit/page.js';
import { h } from '../../../ui/kit/dom.js';

const PAGES = [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }, { id: 'c', title: 'Gamma' }];

test('pager shows the title, "i of n", dots, and wraps previous and next at both ends', () => {
  installFakeDom();
  const went = [];
  const bar = pager({ pages: PAGES, current: 'a', backLabel: '‹ Dossier', onBack: () => went.push('back'), onGo: id => went.push(id) });
  assert.equal(bar.querySelector('.ptl b').textContent, 'Alpha');
  assert.equal(bar.querySelector('.ptl small').textContent, '1 of 3');
  assert.equal(bar.querySelectorAll('.pd i').length, 3);
  assert.equal(bar.querySelectorAll('.pd i.on').length, 1);
  assert.equal(bar.querySelector('.bk2').textContent, '‹ Dossier');
  bar.querySelector('[data-act="previous"]').click();
  bar.querySelector('[data-act="next"]').click();
  bar.querySelector('.bk2').click();
  assert.deepEqual(went, ['c', 'b', 'back']);
});

test('pager with one page has no arrows; an unknown current page shows only the back button', () => {
  installFakeDom();
  const one = pager({ pages: [PAGES[0]], current: 'a' });
  assert.equal(one.querySelectorAll('.pb').length, 0);
  assert.equal(one.querySelector('.ptl small').textContent, '1 of 1');
  const none = pager({ pages: PAGES, current: 'zzz' });
  assert.equal(none.querySelector('.ptl'), null);
  assert.ok(none.querySelector('.bk2'));
  assert.ok(pager());
});

test('pageSection drops empty children and returns null when nothing is left', () => {
  installFakeDom();
  assert.equal(pageSection('Empty', null, undefined, false, []), null);
  const s = pageSection('Title', h('p', null, 'x'), null, [h('p', null, 'y')]);
  assert.equal(s.querySelector('.secl').textContent, 'Title');
  assert.equal(s.querySelectorAll('p').length, 2);
  assert.equal(pageSection(null, h('p', null, 'z')).querySelector('.secl'), null);
});

test('kvList skips empty values, keeps nodes, and returns null when every row is empty', () => {
  installFakeDom();
  const dl = kvList([['A', 'one'], ['B', null], ['C', ''], ['D', h('b', null, 'node')]]);
  assert.deepEqual(dl.querySelectorAll('dt').map(n => n.textContent), ['A', 'D']);
  assert.equal(dl.querySelectorAll('dd')[1].querySelector('b').textContent, 'node');
  assert.equal(kvList([['A', null]]), null);
  assert.equal(kvList(), null);
});
