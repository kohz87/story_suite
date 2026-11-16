import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSuiteView } from '../../../ui/shell/suite-view.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { GLASS_LIGHT } from '../../../ui/theme/tokens.js';

test('mounts closed and inert, with the dark theme written on the root', () => {
  const doc = installFakeDom();
  const view = createSuiteView({ doc });
  assert.equal(doc.body.querySelector('.su-layer').getAttribute('data-state'), 'closed');
  assert.equal(view.layer.getAttribute('aria-hidden'), 'true');
  assert.equal(view.root.hasAttribute('inert'), true);
  assert.equal(view.root.getAttribute('data-scheme'), 'dark');
  assert.ok(view.root.style.getPropertyValue('--su-accent'));
  assert.equal(view.isOpen(), false);
  assert.ok(view.root.contains(view.content));
});

test('open and close slide the layer, call hooks and ignore repeats', () => {
  const doc = installFakeDom();
  const calls = [];
  const view = createSuiteView({ doc, onOpen: () => calls.push('open'), onClose: () => calls.push('close') });
  assert.equal(view.open(), true);
  assert.equal(view.open(), false);
  assert.equal(view.layer.getAttribute('data-state'), 'open');
  assert.equal(view.root.hasAttribute('inert'), false);
  assert.equal(view.close(), true);
  assert.equal(view.close(), false);
  assert.equal(view.root.hasAttribute('inert'), true);
  assert.deepEqual(calls, ['open', 'close']);
});

test('the dim layer closes the suite on click', () => {
  const doc = installFakeDom();
  const view = createSuiteView({ doc });
  view.open();
  view.layer.querySelector('.su-dim').click();
  assert.equal(view.isOpen(), false);
});

test('back-stack: Escape closes the suite, and close releases the entry', () => {
  const doc = installFakeDom();
  const stack = createBackStack();
  const view = createSuiteView({ doc, backStack: stack });
  view.open();
  assert.equal(stack.hasLayer('suite'), true);
  stack.handleKeydown({ key: 'Escape' });
  assert.equal(view.isOpen(), false);
  assert.equal(stack.size(), 0);
  view.open();
  view.close();
  assert.equal(stack.size(), 0);
});

test('setTheme swaps tokens and scheme; bad values are rejected', () => {
  const doc = installFakeDom();
  const view = createSuiteView({ doc });
  const res = view.setTheme(GLASS_LIGHT, 'light');
  assert.equal(res.ok, true);
  assert.equal(view.root.getAttribute('data-scheme'), 'light');
  const bad = view.setTheme({ '--su-accent': 'url(javascript:x)' }, 'dark');
  assert.equal(bad.ok, false);
});

test('destroy closes, removes the layer and makes open a no-op', () => {
  const doc = installFakeDom();
  const view = createSuiteView({ doc });
  view.open();
  view.destroy();
  view.destroy();
  assert.equal(doc.body.querySelector('.su-layer'), null);
  assert.equal(view.open(), false);
});
