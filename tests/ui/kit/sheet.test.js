import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { openSheet } from '../../../ui/kit/sheet.js';

const ov = () => globalThis.document.body.querySelector('.sh-ov');

test('openSheet adds one dialog with a title row and closes by ×, backdrop, Escape, and a repeat close is false', () => {
  installFakeDom();
  const backStack = createBackStack();
  const opener = globalThis.document.createElement('button');
  globalThis.document.body.appendChild(opener);
  opener.focus();
  const sheet = openSheet({ backStack }, { title: 'Scene', id: 's1' });
  assert.equal(ov().querySelector('[role="dialog"]').getAttribute('aria-label'), 'Scene');
  assert.equal(ov().querySelector('h3').textContent, 'Scene');
  assert.equal(ov().dataset.sheet, 's1');
  assert.equal(backStack.hasLayer('sheet'), true);
  assert.equal(globalThis.document.activeElement.className, 'x sh-x');
  ov().querySelector('.sh-x').click();
  assert.equal(ov(), null);
  assert.equal(backStack.hasLayer('sheet'), false);
  assert.equal(globalThis.document.activeElement, opener);
  assert.equal(sheet.close(), false);
  openSheet({ backStack }, { title: 'B' });
  ov().click();
  assert.equal(ov(), null);
  openSheet({ backStack }, { title: 'C' });
  assert.equal(backStack.handleKeydown({ key: 'Escape', preventDefault() {} }), true);
  assert.equal(ov(), null);
  assert.equal(backStack.size(), 0);
});

test('a click inside the panel keeps it open; onClose fires once on every close path', () => {
  installFakeDom();
  const backStack = createBackStack();
  let closed = 0;
  const sheet = openSheet({ backStack }, { title: 'T', onClose: () => { closed += 1; } });
  sheet.body.click();
  assert.notEqual(ov(), null);
  assert.equal(sheet.close(), true);
  assert.equal(closed, 1);
  sheet.close();
  assert.equal(closed, 1);
});

test('without a title there is no header or close button, the label is used, and it works without a back-stack', () => {
  installFakeDom();
  const root = globalThis.document.createElement('div');
  root.className = 'su-root';
  globalThis.document.body.appendChild(root);
  const sheet = openSheet({}, { label: 'Edit quest' });
  assert.equal(ov().parentNode, root);
  assert.equal(ov().querySelector('.sh-h'), null);
  assert.equal(ov().querySelector('[role="dialog"]').getAttribute('aria-label'), 'Edit quest');
  assert.equal(ov().querySelectorAll('.grab').length, 1);
  sheet.body.appendChild(globalThis.document.createElement('p'));
  assert.equal(ov().querySelector('.sh-body').children.length, 1);
  assert.equal(sheet.close(), true);
  assert.equal(root.children.length, 0);
});

test('sheetHost and the fallback label "Sheet" are honoured', () => {
  installFakeDom();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(host);
  const sheet = openSheet({ sheetHost: host });
  assert.equal(host.children.length, 1);
  assert.equal(host.querySelector('[role="dialog"]').getAttribute('aria-label'), 'Sheet');
  sheet.close();
});

const tabbing = (target, shiftKey = false) => target.dispatch('keydown', { key: 'Tab', shiftKey });

test('Tab stays inside an open sheet: the last control wraps to the first, Shift+Tab the other way, and focus from outside is pulled in', () => {
  installFakeDom();
  const outside = globalThis.document.createElement('button');
  globalThis.document.body.appendChild(outside);
  openSheet({}, { title: 'Trap', id: 'trap' });
  const panel = ov().querySelector('.sh-panel');
  const first = ov().querySelector('.sh-x');
  const a = globalThis.document.createElement('button');
  const hidden = globalThis.document.createElement('input');
  hidden.setAttribute('hidden', '');
  const last = globalThis.document.createElement('button');
  panel.querySelector('.sh-body').append(a, hidden, last);
  last.focus();
  assert.equal(tabbing(last).defaultPrevented, true);
  assert.equal(globalThis.document.activeElement, first, 'forward from the last goes to the first (the hidden input is skipped)');
  assert.equal(tabbing(first, true).defaultPrevented, true);
  assert.equal(globalThis.document.activeElement, last, 'Shift+Tab from the first goes to the last');
  a.focus();
  assert.equal(tabbing(a).defaultPrevented, false, 'in the middle the browser moves it');
  outside.focus();
  tabbing(ov());
  assert.equal(globalThis.document.activeElement, first, 'from the page behind, back into the sheet');
});

test('closing a sheet does not take the focus from a window opened over it', () => {
  installFakeDom();
  const opener = globalThis.document.createElement('button');
  globalThis.document.body.appendChild(opener);
  opener.focus();
  const under = openSheet({}, { title: 'Under', id: 'under' });
  const over = openSheet({}, { title: 'Over', id: 'over' });
  const overX = globalThis.document.activeElement;
  assert.equal(overX.closest('.sh-ov').dataset.sheet, 'over');
  under.close();
  assert.equal(globalThis.document.activeElement, overX, 'the top window keeps the focus');
  over.close();
  assert.ok(globalThis.document.activeElement !== overX);
});
