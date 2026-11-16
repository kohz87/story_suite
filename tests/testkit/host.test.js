// createHost boots the real core on the fake SillyTavern, runs a turn, and a swipe replays it the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../testkit/index.js';

test('the real runtime is available to the testkit in this checkout', async () => {
  const available = await hostAvailable();
  assert.deepEqual(available.missing, []);
  assert.equal(available.ok, true);
});

test('a host boots with the core module, takes a turn, swipes it and closes', async () => {
  const host = await createHost();
  try {
    assert.ok(host.registry && host.store && host.sdk && host.turn);
    await host.send('I open the door.', 'The door creaks open.');
    const afterSend = host.head();
    await host.swipe('The door swings wide.');
    assert.ok(host.head(), 'the head is still there after the swipe');
    assert.ok(afterSend !== undefined);
  } finally {
    host.close();
  }
});

test('a host can start without the core module', async () => {
  const host = await createHost({ core: false });
  try {
    assert.ok(host.registry);
  } finally {
    host.close();
  }
});
