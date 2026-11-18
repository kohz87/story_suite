// Boot starts the page parts the view reads without an old view: the RPG's fight parts while the RPG is on (the bridge the Fight tab reads the pause
// through), the Tools page's Inspector and report, and Story Suite's console errors kept for that report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../../testkit/index.js';
import { setupDom } from '../../ui/view/mounts/helpers.js';
import { boot } from '../../../core/boot/boot.js';
import { setLiveOffer } from '../../../ui/port/live-offer.js';
import { HOLD_EVENT } from '../../../modules/rpg/board/hold-bridge.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { resetCaught } from '../../../core/diagnostics.js';

const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise(resolve => setImmediate(resolve)); };
const ask = doc => { const detail = { op: 'view', answer: null, handled: false }; doc.dispatchEvent(new globalThis.CustomEvent(HOLD_EVENT, { detail })); return detail; };

test('boot answers the fight pause\'s bridge while the RPG is on, and stops when it goes off; the Tools report and Inspector need no view', async t => {
  const doc = setupDom();
  doc.head = doc.createElement('head');
  doc.dispatchEvent = event => { for (const entry of [...doc.listeners]) if (entry.type === event.type) entry.fn(event); return true; };
  const st = createFakeContext();
  const keys = ['StoryBlock', 'SillyTavern', 'toastr', 'storyBlockGenerationInterceptor', 'CustomEvent'];
  const saved = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  t.after(() => { setLiveOffer(null); resetCaught?.(); for (const key of keys) { if (saved[key] === undefined) delete globalThis[key]; else globalThis[key] = saved[key]; } });
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'warn', () => {});
  delete globalThis.StoryBlock;
  delete globalThis.storyBlockGenerationInterceptor;
  globalThis.CustomEvent ??= class extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail ?? null; } };
  globalThis.SillyTavern = { getContext: () => st.ctx };
  globalThis.toastr = { warning() {}, info() {}, error() {} };
  assert.equal(await boot(), true);
  await globalThis.StoryBlock.ready;
  assert.equal(ask(doc).handled, false, 'the RPG is off: nothing answers');
  globalThis.StoryBlock.writes.features.set(CORE_FEATURE.leanRpg, true);
  await settle();
  const on = ask(doc);
  assert.equal(on.handled, true, 'the RPG\'s pause answers the bridge');
  assert.equal(on.answer, null, 'nothing waits');
  assert.ok(doc.head.querySelector('link[data-ss-rpg]'), 'the battle log\'s sheets are on the page');
  globalThis.StoryBlock.writes.features.set(CORE_FEATURE.leanRpg, false);
  await settle();
  assert.equal(ask(doc).handled, false, 'off again: the parts are gone');
  assert.equal(doc.head.querySelector('link[data-ss-rpg]'), null);
  console.error('[Story Suite] a test error for the report');
  const report = await globalThis.StoryBlock.tools.report();
  assert.match(report, /a test error for the report/, 'console errors are kept for Diagnostics from boot on');
  assert.ok(globalThis.StoryBlock.tools.replies().some(row => row.index === 0 && row.head === true), 'the Inspector lists the greeting');
});
