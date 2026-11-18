// Pins the redraw scheduler's closed-suite rule, the `first` section order and the frame coalescer by counting reads, draws and runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedraw, frameCoalesced } from '../../../ui/runtime/redraw.js';

const manual = () => { const q = []; return { schedule: fn => q.push(fn), run: () => { while (q.length) q.shift()(); }, size: () => q.length }; };

// A section that counts its reads and draws; `value()` is what it shows.
function counted(redraw, id, section, value = () => 1) {
  const n = { reads: 0, draws: 0, last: undefined };
  redraw.register(id, { ...section, read: () => { n.reads += 1; return value(); }, draw: vm => { n.draws += 1; n.last = vm; } });
  return n;
}

test('while the suite is closed, port events read only the chat and whileClosed sections; open reveals the rest once', () => {
  const f = manual();
  let open = false;
  let text = 'a';
  const redraw = createRedraw({ schedule: f.schedule, initialTab: 'now', isOpen: () => open });
  const card = counted(redraw, 'card', { tab: 'always' }, () => text);
  const now = counted(redraw, 'tab:now', { tab: 'now' }, () => text);
  const chat = counted(redraw, 'chat', { tab: 'chat' }, () => text);
  const flags = counted(redraw, 'flags', { tab: 'always', whileClosed: true });
  for (let i = 0; i < 6; i += 1) { text += i; redraw.markDirty(); }
  f.run();
  assert.deepEqual([card.reads, now.reads, chat.reads, flags.reads], [0, 0, 1, 1], 'closed: card and tab are not read');
  open = true;
  redraw.reveal();
  redraw.flush();
  assert.deepEqual([card.reads, now.reads, chat.reads, flags.reads], [1, 1, 1, 1], 'open: card and tab read once, the others not again');
  assert.deepEqual([card.last, now.last], [text, text], 'what changed while closed is drawn on open');
  redraw.reveal();
  redraw.flush();
  assert.deepEqual([card.reads, now.reads], [1, 1], 'a second reveal with nothing stale reads nothing');
  open = false;
  text += 'x';
  redraw.markDirty();
  f.run();
  assert.deepEqual([card.reads, now.reads, chat.reads], [1, 1, 2], 'closed again: only the chat section is read');
  redraw.destroy();
});

test('without isOpen every section is read on a flush, as before', () => {
  const f = manual();
  const redraw = createRedraw({ schedule: f.schedule, initialTab: 'now' });
  const card = counted(redraw, 'card', { tab: 'always' });
  const now = counted(redraw, 'tab:now', { tab: 'now' });
  redraw.markDirty();
  f.run();
  assert.deepEqual([card.reads, now.reads], [1, 1]);
  redraw.destroy();
});

test('a first section is read and drawn before the others in its flush', () => {
  const f = manual();
  const order = [];
  const redraw = createRedraw({ schedule: f.schedule, initialTab: 'now' });
  let n = 0;
  for (const [id, first] of [['card', false], ['tab:now', false], ['flags', true]]) {
    redraw.register(id, { tab: id === 'tab:now' ? 'now' : 'always', first, read: () => { order.push(`read ${id}`); return n; }, draw: () => order.push(`draw ${id}`) });
  }
  f.run();
  redraw.flush();
  order.length = 0;
  n += 1;
  redraw.markDirty();
  f.run();
  assert.deepEqual(order, ['read flags', 'draw flags', 'read card', 'draw card', 'read tab:now', 'draw tab:now']);
  redraw.destroy();
});

test('frameCoalesced runs once per frame however often it is asked, and never after cancel', () => {
  const f = manual();
  let runs = 0;
  const frame = frameCoalesced(() => { runs += 1; }, f.schedule);
  for (let i = 0; i < 9; i += 1) frame.request();
  assert.equal(f.size(), 1, 'one frame asked for');
  assert.equal(runs, 0, 'nothing runs before the frame');
  f.run();
  assert.equal(runs, 1);
  frame.request();
  frame.request();
  f.run();
  assert.equal(runs, 2, 'a later burst runs once more');
  frame.request();
  frame.cancel();
  f.run();
  frame.request();
  f.run();
  assert.equal(runs, 2, 'cancelled: the pending run and later ones are dropped');
});
