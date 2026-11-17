import test from 'node:test';
import assert from 'node:assert/strict';
import { extrasCommand } from '../../../ui/port/extras.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createHost } from '../../../testkit/index.js';

const wiresOf = host => ({ settings: { set: (id, key, v) => host.settings.set(id, key, v) }, features: { set: (id, on) => host.features.set(id, on) } });
const stateOf = host => ({ settings: host.settings('story-block'), features: ['choices', 'chatter', 'you'].map(n => host.features.on(`story-block.${n}`)) });

test('a row change stores the same value the old view stores (host.settings.set on Story Block)', async t => {
  t.mock.method(console, 'warn', () => {});
  const old = await createHost(); const now = await createHost();
  t.after(() => { old.close(); now.close(); });
  const port = createSbPort({ sdk: now.sdk, writes: wiresOf(now) });
  for (const [key, field, value] of [['extras.sendBack', 'chatterInPrompt', true], ['extras.chatterLines', 'chatterMax', 7], ['extras.chatterLines', 'chatterMax', 99], ['extras.sendBack', 'chatterInPrompt', false]]) {
    old.settings.set('story-block', field, value);
    assert.equal((await port.command('settings.set', { key, value })).ok, true);
    assert.deepEqual(now.settings('story-block'), old.settings('story-block'), `${key} = ${value}`);
  }
  assert.equal(now.settings('story-block').chatterMax, 10, 'the schema clamps as it does in the old view');
});

test('a number the schema cannot take is not stored and says so', () => {
  const writes = { settings: { set: () => undefined } };
  assert.equal(extrasCommand('settings.set', { key: 'extras.chatterLines', value: '' }, writes).ok, false);
});

test('the switches write the same features the old Features page does; the master switch writes all three', async t => {
  t.mock.method(console, 'warn', () => {});
  const old = await createHost(); const now = await createHost();
  t.after(() => { old.close(); now.close(); });
  const port = createSbPort({ sdk: now.sdk, writes: wiresOf(now) });
  old.features.set('story-block.chatter', true);
  await port.command('settings.set', { key: 'modules.chat.extras.chatter', value: true });
  assert.deepEqual(stateOf(now), stateOf(old));
  old.features.set('story-block.you', false);
  await port.command('settings.set', { key: 'modules.chat.extras.you', value: false });
  assert.deepEqual(stateOf(now), stateOf(old));
  await port.command('settings.set', { key: 'modules.chat.extras', value: false });
  assert.deepEqual(stateOf(now).features, [false, false, false]);
  await port.command('settings.set', { key: 'modules.chat.extras', value: true });
  assert.deepEqual(stateOf(now).features, [true, true, true]);
});

test('other keys are not this page\'s; unknown switches fail', () => {
  assert.equal(extrasCommand('settings.set', { key: 'host.tailBudget', value: 1 }, {}), null);
  assert.equal(extrasCommand('settings.action', { key: 'extras.sendBack' }, {}), null);
  assert.equal(extrasCommand('settings.set', { key: 'modules.chat.extras.nope', value: true }, {}).ok, false);
});
