// Pins the mount's per-frame reads: a burst of port events reads the light flags view once a frame (never the card, fight or scene views for them),
// the card once (its sky too), and nothing but the flags while the suite is closed; the flags are applied before the tab draws in that frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/ui-fake-dom.js';
import { mountSuite } from '../../ui/mount.js';
import { createFakePort } from '../../ui/port/fake-port.js';

const EVENTS = ['head', 'committed', 'turn', 'feature', 'offer', 'interaction'];
const manual = () => { const q = []; return { schedule: fn => q.push(fn), run: () => { while (q.length) q.shift()(); } }; };

// The fake port with a `flags` view and a Now view that changes each time it is asked; `count` is port.view calls per tab, `order` their sequence.
function countingPort() {
  const base = createFakePort();
  const count = {};
  const order = [];
  const state = { flags: { rpg: true, fightOpen: false, sceneOpen: false, sceneTitle: '' }, now: 0 };
  const view = (tab, args) => {
    count[tab] = (count[tab] ?? 0) + 1;
    order.push(tab);
    if (tab === 'flags') return structuredClone(state.flags);
    if (tab === 'now') return { ...base.view('now'), n: state.now };
    return base.view(tab, args);
  };
  const reset = () => { for (const k of Object.keys(count)) delete count[k]; order.length = 0; };
  return { port: { ...base, view }, count, order, state, reset, emit: base.emit };
}

test('a burst of port events with the suite open reads flags, card and tab once each in one frame', () => {
  const doc = installFakeDom();
  const f = manual();
  const p = countingPort();
  const suite = mountSuite({ port: p.port, doc, schedule: f.schedule });
  suite.open();
  f.run();
  p.reset();
  for (const event of EVENTS) p.emit(event);
  assert.deepEqual(p.count, {}, 'nothing is read before the frame');
  f.run();
  assert.deepEqual(p.count, { flags: 1, card: 1, now: 1 }, 'one read each: no card, fight or scene reads for the flags, one card read for the card and its sky');
  suite.destroy();
});

test('while the suite is closed port events read only the flags; open reads the card and the tab once', () => {
  const doc = installFakeDom();
  const f = manual();
  const p = countingPort();
  const suite = mountSuite({ port: p.port, doc, schedule: f.schedule });
  p.reset();
  for (let i = 0; i < 3; i += 1) {
    for (const event of EVENTS) p.emit(event);
    f.run();
  }
  assert.deepEqual(p.count, { flags: 3 }, 'three frames: the flags each time, never the card or the Now tab');
  p.state.now = 7;
  suite.open();
  assert.deepEqual(p.count, { flags: 3, card: 1, now: 1 }, 'open: the card and the tab once; the flags were kept current');
  assert.ok(doc.body.querySelector('[data-tab="now"]'), 'the Now tab is drawn on open');
  assert.ok(doc.body.querySelector('[data-card="character"]'), 'the card is drawn on open');
  suite.destroy();
});

test('a fight that begins is in the tab strip and in the flags the tab is drawn with, in the same frame', () => {
  const doc = installFakeDom();
  const f = manual();
  const p = countingPort();
  const seen = [];
  const suite = mountSuite({ port: p.port, doc, schedule: f.schedule, tabs: { now: (vm, ctx) => { seen.push(ctx.flags.fightOpen); return doc.createElement('i'); } } });
  suite.open();
  f.run();
  seen.length = 0;
  p.reset();
  p.state.flags = { ...p.state.flags, fightOpen: true };
  p.state.now = 1;
  p.emit('head');
  f.run();
  assert.equal(suite.tabHost.tabs().includes('fight'), true);
  assert.deepEqual(seen, [true], 'the Now tab was drawn once, after the flags');
  assert.deepEqual(p.order, ['flags', 'card', 'now']);
  suite.destroy();
});

test('a port without a flags view is read the old way: card, scene and fight', () => {
  const doc = installFakeDom();
  const base = createFakePort();
  const count = {};
  const port = { ...base, view: (tab, args) => { count[tab] = (count[tab] ?? 0) + 1; return base.view(tab, args); } };
  const suite = mountSuite({ port, doc });
  assert.deepEqual(count, { flags: 1, scene: 1, card: 1, fight: 1 });
  suite.destroy();
});
