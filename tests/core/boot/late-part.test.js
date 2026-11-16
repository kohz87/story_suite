// A part that starts after the modules (the People part) cannot stop Story Suite: a throw is a Problem in Diagnostics (MODULE_START) and the host is up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../../testkit/index.js';
import { setupDom } from '../../ui/view/mounts/helpers.js';
import { boot } from '../../../core/boot/boot.js';
import { startIsolated } from '../../../core/boot/register-isolated.js';

test('boot with a late part that throws: Story Suite is ready, the failure is logged and later parts still start', async t => {
  const doc = setupDom();
  doc.head = doc.createElement('head');
  const st = createFakeContext();
  const saved = { StoryBlock: globalThis.StoryBlock, SillyTavern: globalThis.SillyTavern, toastr: globalThis.toastr, gen: globalThis.storyBlockGenerationInterceptor };
  t.after(() => { for (const [key, value] of Object.entries({ StoryBlock: saved.StoryBlock, SillyTavern: saved.SillyTavern, toastr: saved.toastr, storyBlockGenerationInterceptor: saved.gen })) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  const errors = t.mock.method(console, 'error', () => {});
  const infos = t.mock.method(console, 'info', () => {});
  delete globalThis.StoryBlock;
  delete globalThis.storyBlockGenerationInterceptor;
  globalThis.SillyTavern = { getContext: () => st.ctx };
  globalThis.toastr = { warning() {}, info() {}, error() {} };
  const started = [];
  const late = [
    { id: 'people', name: 'NPC State', start: async () => { throw new Error('hardening failed'); } },
    { id: 'after', name: 'After', start: async () => { started.push('after'); } },
  ];
  assert.equal(await boot({ late }), true);
  const sdk = await globalThis.StoryBlock.ready;
  assert.ok(sdk, 'the host is ready');
  assert.deepEqual(started, ['after'], 'the next part still starts');
  assert.ok(infos.mock.calls.some(call => call.arguments[0] === 'Story Suite 0.1.0 ready'), 'the banner is the suite version');
  assert.equal(globalThis.StoryBlock.version, '2.33.0', 'the host compatibility number is kept under its own name');
  assert.ok(errors.mock.calls.some(call => /NPC State could not start: hardening failed/.test(String(call.arguments[0]))), 'logged');
});

test('startIsolated puts a throw on the Problems list as MODULE_START and resolves false; a clean start resolves true', async t => {
  t.mock.method(console, 'error', () => {});
  const reports = [];
  const runtime = { turn: { report: entry => reports.push(entry) } };
  assert.equal(await startIsolated(runtime, { id: 'people', name: 'NPC State', start: async () => { throw new Error('boom'); } }), false);
  assert.deepEqual(reports, [{ module: 'people', code: 'MODULE_START', message: 'NPC State could not start: boom' }]);
  assert.equal(await startIsolated(runtime, { id: 'ok', name: 'Ok', start: async () => {} }), true);
  assert.equal(reports.length, 1);
});
