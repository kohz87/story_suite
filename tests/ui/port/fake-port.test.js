import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPort } from '../../../ui/port/contract.js';
import { createFakePort } from '../../../ui/port/fake-port.js';

test('createFakePort satisfies checkPort and returns cloned view-models', () => {
  const port = createFakePort();
  assert.equal(checkPort(port).ok, true);

  const cardA = port.view('card');
  cardA.scene.time = 'mutated';
  const cardB = port.view('card');
  assert.equal(cardB.scene.time, '9:30 am');
  assert.equal(port.view('unknown-tab'), null);
});

test('createFakePort records command, preview, and commit calls', async () => {
  const port = createFakePort();
  const cmdRes = await port.command('item.equip', { stack: 'shield' });
  assert.equal(cmdRes.ok, true);

  const prevRes = await port.preview('mounts.edit', { id: 'mare' });
  assert.equal(prevRes.ok, true);
  assert.ok(prevRes.token.startsWith('fake-preview-'));

  const comRes = await port.commit(prevRes.token);
  assert.equal(comRes.ok, true);

  assert.equal(port.recorded.length, 3);
  assert.deepEqual(port.recorded.map(r => r.kind), ['command', 'preview', 'commit']);
  assert.equal(port.recorded[0].type, 'item.equip');
  assert.equal(port.recorded[2].token, prevRes.token);

  port.clearRecorded();
  assert.equal(port.recorded.length, 0);
});

test('createFakePort emits events and supports unsubscribe and setVariant', () => {
  const port = createFakePort();
  const events = [];
  const off = port.on('head', payload => events.push(payload));

  assert.equal(port.emit('head', { seq: 1 }), 1);
  port.setVariant('fightOpen', { notify: true });
  assert.equal(port.view('card').scene.time, '2:10 pm');
  assert.equal(events.length, 2);

  off();
  assert.equal(port.emit('head', { seq: 3 }), 0);
  assert.throws(() => port.on('head', 'nope'), TypeError);
});
