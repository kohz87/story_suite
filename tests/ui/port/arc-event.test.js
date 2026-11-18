// The port's `arc` event follows the arc planner, so a plan it makes on its own (and "Planning…") reaches the view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSbPort } from '../../../ui/port/sb-port.js';

function fakeArc() {
  const fns = new Set();
  return { fns, controller: { subscribe: (fn) => { fns.add(fn); return () => fns.delete(fn); } } };
}

test('port.on("arc") hears the planner and stops after it is unsubscribed', () => {
  const { fns, controller } = fakeArc();
  const port = createSbPort({ sdk: {}, arc: () => controller });
  let heard = 0;
  const off = port.on('arc', () => { heard += 1; });
  for (const fn of [...fns]) fn();
  assert.equal(heard, 1);
  off();
  assert.equal(fns.size, 0);
});

test('a planner that cannot be reached gives a harmless listener', () => {
  const port = createSbPort({ sdk: {}, arc: () => { throw new Error('no planner'); } });
  const off = port.on('arc', () => {});
  assert.equal(typeof off, 'function');
  off();
});
