// Boot builds the card offer and the save points once: the Tools handle and the live offer reach the same instances.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../../testkit/index.js';
import { setupDom } from '../../ui/view/mounts/helpers.js';
import { boot } from '../../../core/boot/boot.js';
import { liveOffer, setLiveOffer } from '../../../ui/port/live-offer.js';
import { selectSavePoints } from '../../../ui/select/tools.js';

test('after boot the live offer and the Tools handle\'s save points exist', async t => {
  const doc = setupDom();
  doc.head = doc.createElement('head');
  const st = createFakeContext();
  const saved = { StoryBlock: globalThis.StoryBlock, SillyTavern: globalThis.SillyTavern, toastr: globalThis.toastr, gen: globalThis.storyBlockGenerationInterceptor };
  t.after(() => { setLiveOffer(null); for (const [key, value] of Object.entries({ StoryBlock: saved.StoryBlock, SillyTavern: saved.SillyTavern, toastr: saved.toastr, storyBlockGenerationInterceptor: saved.gen })) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'warn', () => {});
  delete globalThis.StoryBlock;
  delete globalThis.storyBlockGenerationInterceptor;
  setLiveOffer(null);
  globalThis.SillyTavern = { getContext: () => st.ctx };
  globalThis.toastr = { warning() {}, info() {}, error() {} };
  assert.equal(await boot(), true);
  await globalThis.StoryBlock.ready;
  assert.ok(liveOffer(), 'the controller exists');
  const read = globalThis.StoryBlock.tools.savePoints();
  assert.equal(read.on, true, 'the feature is on by default');
  assert.deepEqual(read.points, []);
  assert.deepEqual(selectSavePoints(read), { full: false, max: { name: 60 }, rows: [] });
  assert.equal(selectSavePoints({ ...read, on: false }), null, 'off: no card');
});

test('selectSavePoints: the message is the position the point was made at, the open branch is marked', () => {
  const view = selectSavePoints({ on: true, here: 'b2', points: [{ id: 'sp_aaaaaaaa', name: 'A', index: 4, branch: 'b1', at: '2026-11-18T09:05:00.000Z' }, { id: 'sp_bbbbbbbb', name: 'B', index: null, branch: 'b2', at: '' }] });
  assert.deepEqual(view.rows.map(r => [r.reply, r.here]), [[5, false], [null, true]]);
  assert.equal(view.rows[1].date, '');
  assert.match(view.rows[0].date, /2026|Nov/);
});
