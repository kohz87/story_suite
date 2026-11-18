// The Pairing row's count in the nav (STFE): answered without checking, settled once the packs stand still, and kept per pack hash, so an edit's redraw never runs the pair check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairBadge, WAIT } from '../../../studio/pair-count.js';
import { navBadges } from '../../../studio/nav-counts.js';

const WORLD = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
const later = () => new Promise(resolve => setTimeout(resolve, WAIT + 150));

test('no answer at first, never a check in the call; then one answer, and onReady once it is there', async () => {
  let ready = 0;
  const world = structuredClone(WORLD);
  assert.equal(pairBadge(world, null, () => { ready += 1; }), null);
  assert.equal(ready, 0, 'nothing is checked inside the call');
  await later();
  assert.equal(ready, 1);
  const answer = pairBadge(world, null, () => { ready += 1; });
  assert.deepEqual(Object.keys(answer), ['errors', 'warnings']);
  assert.equal(ready, 1, 'the same packs: the answer stands, no second call');
});

test('a burst of edits is one check after they stop; the same content again (an undo) is not checked again', async () => {
  let ready = 0;
  const count = () => { ready += 1; };
  const a = structuredClone(WORLD);
  pairBadge(a, GAME, count);
  await later();
  const first = pairBadge(a, GAME, count);
  const marks = [];
  for (let at = 0; at < 5; at += 1) { const edit = structuredClone(a); edit.description = `edit ${at}`; marks.push(pairBadge(edit, GAME, count)); }
  assert.ok(marks.every(mark => mark === first), 'during the edits the last answer is shown');
  const back = structuredClone(a);
  const before = ready;
  pairBadge(back, GAME, count);
  await later();
  assert.equal(ready, before, 'a copy of the same content gives the same answer: nothing changed, nothing redrawn');
});

test('the nav row: 0 for a fit pair, ✕ for problems, ! for warnings; none before the answer; held while a pack has problems', () => {
  const part = { id: 'pairing', page: 'pairing', sections: [] };
  const packs = { world: { doc: {}, check: { errors: [], warnings: [], byPart: {} } }, game: null };
  const row = pair => navBadges([part], packs, 'world', pack => pack.name, () => pair).pairing;
  assert.equal(row(null), undefined);
  assert.equal(row({ errors: 0, warnings: 0 }).text, '0');
  assert.equal(row({ errors: 0, warnings: 2 }).text, '! 2');
  assert.deepEqual([row({ errors: 3, warnings: 0 }).text, row({ errors: 3, warnings: 0 }).bad], ['✕ 3', true]);
  packs.world.check.errors = [{}];
  assert.equal(row({ errors: 0, warnings: 0 }).text, '—');
});
