import test from 'node:test';
import assert from 'node:assert/strict';
import { PORT_METHODS, checkPort } from '../../../ui/port/contract.js';

test('PORT_METHODS lists the 5 required port methods', () => {
  assert.deepEqual(PORT_METHODS, ['view', 'command', 'preview', 'commit', 'on']);
});

test('checkPort accepts a valid port object', () => {
  const valid = {
    view: () => null,
    command: async () => ({}),
    preview: async () => ({}),
    commit: async () => ({}),
    on: () => () => {},
  };
  const res = checkPort(valid);
  assert.equal(res.ok, true);
  assert.deepEqual(res.missing, []);
  assert.deepEqual(res.errors, []);
});

test('checkPort rejects null, primitives, and objects missing methods', () => {
  assert.equal(checkPort(null).ok, false);
  assert.equal(checkPort('port').ok, false);

  const partial = { view: () => null, command: 'not-a-fn' };
  const res = checkPort(partial);
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, ['command', 'preview', 'commit', 'on']);
  assert.equal(res.errors.length, 4);
});
