import test from 'node:test';
import assert from 'node:assert/strict';
import { autoCapped } from '../../../ui/port/auto-fight.js';

// A fake sdk.interaction: each auto(id, 1, held) plays one exchange; the fight is won after `winAt` exchanges.
function fakeApi({ winAt = 99 } = {}) {
  const calls = [];
  let played = 0;
  const result = () => ({ stop: played >= winAt ? 'won' : 'open', rounds: played ? [[]] : [], party: [] });
  return { calls, current: () => ({ id: 'f1', view: { result: result() } }),
    auto(id, n, held) { calls.push([id, n, held ?? null]); played += 1; return { ok: true, view: { result: result() } }; } };
}

test('the board Auto plays the Most exchanges Auto plays setting, 3 when unset', () => {
  const api = fakeApi();
  const answer = autoCapped(api, { id: 'f1' }, {});
  assert.equal(answer.ok, true);
  assert.equal(answer.staged, 3);
  assert.equal(api.calls.length, 3);
  const five = fakeApi();
  assert.equal(autoCapped(five, { id: 'f1' }, { rpgAutoCap: 5 }).staged, 5);
});

test('the board Auto stops early on a win, and 9 plays until the end', () => {
  const api = fakeApi({ winAt: 2 });
  const answer = autoCapped(api, { id: 'f1' }, { rpgAutoCap: 6 });
  assert.deepEqual([answer.staged, answer.stop], [2, 'won']);
  const long = fakeApi({ winAt: 12 });
  assert.equal(autoCapped(long, { id: 'f1' }, { rpgAutoCap: 9 }).staged, 12);
});

test('the stance switch goes with the first exchange only, and another fight id is refused', () => {
  const api = fakeApi();
  autoCapped(api, { id: 'f1', stance: { a: false } }, {});
  assert.deepEqual(api.calls.map(call => call[2]), [{ a: false }, null, null]);
  const other = fakeApi();
  const answer = autoCapped(other, { id: 'nope' }, {});
  assert.equal(answer.ok, false);
  assert.equal(other.calls.length, 0);
});
