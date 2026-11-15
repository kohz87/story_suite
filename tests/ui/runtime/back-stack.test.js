import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBackStack } from '../../../ui/runtime/back-stack.js';

describe('createBackStack', () => {
  it('pops in strict Escape order: menu -> sheet -> page -> settings -> suite -> chat', () => {
    const stack = createBackStack();
    const order = [];

    // Push deliberately out of priority order.
    stack.push({ id: 'chat', layer: 'chat', close: () => order.push('chat') });
    stack.push({ id: 'suite', layer: 'suite', close: () => order.push('suite') });
    stack.push({ id: 'page', layer: 'page', close: () => order.push('page') });
    stack.push({ id: 'settings', layer: 'settings', close: () => order.push('settings') });
    stack.push({ id: 'menu', layer: 'menu', close: () => order.push('menu') });
    stack.push({ id: 'sheet', layer: 'sheet', close: () => order.push('sheet') });

    assert.equal(stack.size(), 6);
    assert.equal(stack.top().layer, 'menu');
    assert.deepEqual(
      stack.list().map(e => e.layer),
      ['menu', 'sheet', 'page', 'settings', 'suite', 'chat'],
    );

    while (stack.size() > 0) {
      stack.pop();
    }

    assert.deepEqual(order, ['menu', 'sheet', 'page', 'settings', 'suite', 'chat']);
    assert.equal(stack.pop(), null);
    assert.equal(stack.top(), null);
  });

  it('pops LIFO within the same layer and passes origin to close', () => {
    const stack = createBackStack();
    const closed = [];

    stack.push({
      id: 'dossier-1',
      layer: 'page',
      origin: { tab: 'now' },
      close: info => closed.push(info),
    });
    stack.push({
      id: 'dossier-2',
      layer: 'page',
      origin: { tab: 'people', scrollTop: 40 },
      close: info => closed.push(info),
    });

    const first = stack.back();
    assert.equal(first.id, 'dossier-2');
    assert.deepEqual(first.origin, { tab: 'people', scrollTop: 40 });

    const second = stack.back();
    assert.equal(second.id, 'dossier-1');
    assert.deepEqual(second.origin, { tab: 'now' });

    assert.equal(closed.length, 2);
  });

  it('handles Escape keydown on document and respects defaultPrevented', () => {
    const listeners = new Map();
    const doc = {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        listeners.get(type)?.delete(fn);
      },
      dispatch(type, event) {
        for (const fn of listeners.get(type) ?? []) fn(event);
      },
    };
    const stack = createBackStack();
    let closed = 0;
    stack.push({ id: 'sheet-1', layer: 'sheet', close: () => { closed += 1; } });

    const unbind = stack.bindDocument(doc);

    assert.equal(stack.handleKeydown({ key: 'Enter', preventDefault() {} }), false);
    assert.equal(stack.handleKeydown({ key: 'Escape', defaultPrevented: true, preventDefault() {} }), false);
    assert.equal(closed, 0);

    let prevented = false;
    doc.dispatch('keydown', {
      type: 'keydown',
      key: 'Escape',
      defaultPrevented: false,
      preventDefault() { prevented = true; },
    });

    assert.equal(prevented, true);
    assert.equal(closed, 1);
    assert.equal(stack.size(), 0);

    unbind();
    assert.equal(listeners.get('keydown')?.size ?? 0, 0);
  });

  it('supports remove, cancel on false return, clear, and layer checks', () => {
    const stack = createBackStack();
    let allowClose = false;

    const dispose = stack.push({
      id: 's1',
      layer: 'settings',
      close: () => allowClose,
    });

    assert.equal(stack.has('s1'), true);
    assert.equal(stack.hasLayer('settings'), true);
    assert.equal(stack.pop(), null);
    assert.equal(stack.has('s1'), true);

    allowClose = true;
    assert.equal(stack.pop().id, 's1');
    assert.equal(stack.has('s1'), false);

    stack.push({ id: 'm1', layer: 'menu', close: () => {} });
    stack.push({ id: 'p1', layer: 'page', close: () => {} });
    assert.equal(stack.remove('m1'), true);
    assert.equal(stack.remove('missing'), false);

    dispose();
    stack.clear('page');
    assert.equal(stack.size(), 0);

    assert.throws(() => stack.push({ layer: 'bogus', close: () => {} }), TypeError);
    assert.throws(() => stack.push({ layer: 'menu' }), TypeError);
    assert.throws(() => stack.clear('bogus'), TypeError);
  });
});
