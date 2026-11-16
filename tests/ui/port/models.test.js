import test from 'node:test';
import assert from 'node:assert/strict';
import { modelsCommand } from '../../../ui/port/models.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

function sdk({ answer = { ok: true, text: 'ok' } } = {}) {
  const stored = {};
  const calls = [];
  return {
    stored, calls,
    settings: { set: (id, key, value) => { stored[key] = value; return value; } },
    callModel: async request => { calls.push(request); return answer; },
  };
}

test('picking a connection stores the role\'s profile name on the host settings', async () => {
  const s = sdk();
  assert.deepEqual(await modelsCommand(s, 'settings.set', { key: 'models.quick', value: 'Cheap' }), { ok: true, value: 'Cheap' });
  await modelsCommand(s, 'settings.set', { key: 'models.background', value: '' });
  assert.deepEqual(s.stored, { quickConnection: 'Cheap', backgroundConnection: '' });
  assert.equal((await modelsCommand(s, 'settings.set', { key: 'models.story', value: 'x' })).ok, false, 'Story has no setting');
});

test('Test makes one tiny call on the role and answers with the seconds, or the message', async () => {
  const s = sdk();
  let t = 1000;
  const clock = () => { t += 1200; return t; };
  const ok = await modelsCommand(s, 'settings.action', { key: 'models.test', value: 'background' }, clock);
  assert.deepEqual([ok.ok, ok.seconds], [true, 1.2]);
  assert.deepEqual([s.calls.length, s.calls[0].role, s.calls[0].maxTokens], [1, 'background', 8]);
  const bad = await modelsCommand(sdk({ answer: { ok: false, message: 'timed out' } }), 'settings.action', { key: 'models.test', value: 'quick' });
  assert.deepEqual(bad, { ok: false, message: 'timed out' });
});

test('other commands are not the Models page\'s: null, and the port hands them to the sdk', async () => {
  assert.equal(await modelsCommand(sdk(), 'settings.set', { key: 'host.tailBudget', value: 1 }), null);
  assert.equal(await modelsCommand(sdk(), 'suite.go', {}), null);
  const calls = [];
  const port = createSbPort({ sdk: { ...sdk(), command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; } } });
  await port.command('settings.set', { key: 'host.tailBudget', value: 2 });
  assert.deepEqual(calls, [['settings.set', { key: 'host.tailBudget', value: 2 }]]);
  const own = sdk();
  await createSbPort({ sdk: own }).command('settings.set', { key: 'models.quick', value: 'Cheap' });
  assert.equal(own.stored.quickConnection, 'Cheap');
});
