// The waiting fight's page bridge: the Suite view reads and answers the pause through one event, and claims the Fight screen through another; with nobody listening the old view opens it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachHoldBridge, claimScreen, HOLD_EVENT, SCREEN_EVENT } from '../../../../modules/rpg/board/hold-bridge.js';
import { foeStats } from '../../../../modules/rpg/combat/foes.js';

function fakeDoc() {
  const listeners = [];
  return {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => listeners.splice(listeners.findIndex(entry => entry.type === type && entry.fn === fn), 1),
    dispatchEvent: event => { for (const entry of [...listeners]) if (entry.type === event.type) entry.fn(event); return true; },
    listeners,
  };
}
const ask = (doc, op) => { const detail = { op, answer: null, handled: false }; doc.dispatchEvent(new CustomEvent(HOLD_EVENT, { detail })); return detail; };

test('nobody claims a screen on a page without the Suite view; a listener that shows it claims it', () => {
  const doc = fakeDoc();
  assert.equal(claimScreen(doc, 'story-block/fight'), false);
  doc.addEventListener(SCREEN_EVENT, event => { if (event.detail.id === 'story-block/fight') event.detail.handled = true; });
  assert.equal(claimScreen(doc, 'story-block/fight'), true);
  assert.equal(claimScreen(doc, 'story-block/party'), false);
  assert.equal(claimScreen(null, 'story-block/fight'), false);
});

test('the bridge answers the pause\'s view with each group\'s full health, runs the five answers, and stops when detached', () => {
  const doc = fakeDoc(), calls = [];
  const info = { id: 'a:0:story-block/fight', kindId: 'story-block/fight', mode: 'new', choice: null, foes: [{ name: 'Rats', count: 3, level: 2, tier: 'minion' }] };
  const start = { info: () => info, board: () => calls.push('board'), auto: () => calls.push('auto'), plain: () => calls.push('plain'), send: () => calls.push('send'), discard: run => { calls.push('discard'); run(); } };
  const off = attachHoldBridge({ doc, start, discard: () => calls.push('thrown away') });
  const view = ask(doc, 'view');
  assert.equal(view.handled, true);
  assert.equal(view.answer.foes[0].hp, foeStats({ level: 2, tier: 'minion' }).hp);
  for (const op of ['board', 'auto', 'plain', 'send', 'discard']) assert.equal(ask(doc, op).handled, true, op);
  assert.deepEqual(calls, ['board', 'auto', 'plain', 'send', 'discard', 'thrown away']);
  assert.equal(ask(doc, 'unknown').handled, false, 'an unknown op is not answered');
  off();
  assert.equal(ask(doc, 'view').handled, false);
});

test('a throwing answer is reported, not thrown into the page', () => {
  const doc = fakeDoc();
  attachHoldBridge({ doc, start: { info: () => null, board: () => { throw new Error('no board'); } } });
  const got = ask(doc, 'board');
  assert.equal(got.handled, true);
  assert.equal(got.error, 'no board');
  assert.equal(ask(doc, 'view').answer, null, 'nothing waits: null');
});
