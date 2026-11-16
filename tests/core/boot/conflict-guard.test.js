// An old Story Block still enabled: Story Suite shows one toast and a Diagnostics line, and does not start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../../testkit/index.js';
import { boot, OLD_COPY } from '../../../core/boot/boot.js';

test('boot stops when globalThis.StoryBlock already exists, and touches nothing', async t => {
  const old = Object.freeze({ apiVersion: 2, old: true });
  const st = createFakeContext();
  const toasts = [];
  const saved = { StoryBlock: globalThis.StoryBlock, SillyTavern: globalThis.SillyTavern, toastr: globalThis.toastr, gen: globalThis.storyBlockGenerationInterceptor };
  t.after(() => { for (const [key, value] of Object.entries({ StoryBlock: saved.StoryBlock, SillyTavern: saved.SillyTavern, toastr: saved.toastr, storyBlockGenerationInterceptor: saved.gen })) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  t.mock.method(console, 'error', () => {});
  globalThis.StoryBlock = old;
  globalThis.SillyTavern = { getContext: () => st.ctx };
  globalThis.toastr = { error: message => toasts.push(message), warning() {}, info() {} };
  delete globalThis.storyBlockGenerationInterceptor;
  assert.equal(await boot(), false);
  assert.equal(globalThis.StoryBlock, old, 'the old host is left as it was');
  assert.deepEqual(toasts, [OLD_COPY], 'one toast');
  assert.match(OLD_COPY, /Disable the old Story Block, Story Director and NPC State Delta/);
  assert.equal(globalThis.storyBlockGenerationInterceptor, undefined, 'no interceptor installed');
  assert.equal(st.ctx.extensionSettings?.storySuite, undefined, 'the settings tree is not touched');
});
