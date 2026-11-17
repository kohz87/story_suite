import test from 'node:test';
import assert from 'node:assert/strict';
import { modelsCommand } from '../../../ui/port/models.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createRuntime } from '../../../core/runtime.js';
import { createFakeContext } from '../../../testkit/fake-st.js';

function sdk({ answer = { ok: true, text: 'ok' } } = {}) {
  const stored = {};
  const calls = [];
  return {
    stored, calls,
    writes: { settings: { set: (id, key, value) => { stored[key] = value; return value; } } },
    callModel: async request => { calls.push(request); return answer; },
  };
}

test('picking a connection stores the role\'s profile name on the host settings', async () => {
  const s = sdk();
  assert.deepEqual(await modelsCommand(s, 'settings.set', { key: 'models.quick', value: 'Cheap' }, Date.now, s.writes), { ok: true, value: 'Cheap' });
  await modelsCommand(s, 'settings.set', { key: 'models.background', value: '' }, Date.now, s.writes);
  assert.deepEqual(s.stored, { quickConnection: 'Cheap', backgroundConnection: '' });
  assert.equal((await modelsCommand(s, 'settings.set', { key: 'models.story', value: 'x' }, Date.now, s.writes)).ok, false, 'Story has no setting');
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
  assert.equal(await modelsCommand(sdk(), 'settings.set', { key: 'look.nothing', value: 1 }), null);
  assert.equal(await modelsCommand(sdk(), 'suite.go', {}), null);
  const calls = [];
  const port = createSbPort({ sdk: { ...sdk(), command: async (type, payload) => { calls.push([type, payload]); return { ok: true }; } } });
  await port.command('settings.set', { key: 'look.nothing', value: 2 });
  assert.deepEqual(calls, [['settings.set', { key: 'look.nothing', value: 2 }]]);
  const own = sdk();
  await createSbPort({ sdk: own, writes: own.writes }).command('settings.set', { key: 'models.quick', value: 'Cheap' });
  assert.equal(own.stored.quickConnection, 'Cheap');
});

// The real runtime's public sdk has no settings.set or features.set; the page writes through `runtime.writes` (what StoryBlock.writes is).
function real() {
  const st = createFakeContext({ chat: [] });
  const runtime = createRuntime({ ctx: st.ctx });
  return { runtime, saved: () => st.ctx.extensionSettings.storySuite, port: createSbPort({ sdk: runtime.sdk, writes: runtime.writes }) };
}

test('the real sdk has no setter, so the Calls group and the connections save through the host writes', async () => {
  const { runtime, saved, port } = real();
  assert.equal(runtime.sdk.settings.set, undefined);
  assert.equal(runtime.sdk.features.set, undefined);
  assert.equal((await port.command('settings.set', { key: 'calls.queue', value: false })).ok, true);
  assert.equal((await port.command('settings.set', { key: 'calls.kinds', value: ['Time set', 'World news'] })).ok, true);
  assert.equal((await port.command('settings.set', { key: 'calls.fallback', value: true })).ok, true);
  assert.equal((await port.command('settings.set', { key: 'models.quick', value: 'Cheap' })).ok, true);
  assert.equal(saved().core.callQueue, false);
  assert.equal(saved().modules['story-block'].assistExtractorKinds, '! time, + world');
  assert.equal(saved().features['story-block.extractor'], true);
  assert.equal(saved().core.quickConnection, 'Cheap');
  assert.equal(runtime.sdk.settings(null).callQueue, false, 'and the engine reads it back');
  assert.equal(runtime.sdk.feature('story-block.extractor'), true);
  assert.equal((await port.command('settings.set', { key: 'calls.queue', value: true })).ok, true);
  assert.equal(runtime.sdk.settings(null).callQueue, true);
});

test('without the host writes nothing is claimed saved, and an unknown Calls key is refused', async () => {
  const s = sdk();
  assert.equal((await modelsCommand(s, 'settings.set', { key: 'calls.fallback', value: true })).ok, false);
  assert.equal((await modelsCommand(s, 'settings.set', { key: 'calls.queue', value: true })).ok, false);
  assert.equal((await modelsCommand(s, 'settings.set', { key: 'calls.nope', value: 1 }, Date.now, s.writes)).ok, false);
});
