// The dossier's dates from stored records: memory dates and replies from NPC State's memory stamps (none without a stamp), the meter changes' replies,
// the mood history with its reasons, and the top bar's last reply (never the scan counter).
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDossier } from '../../../ui/select/dossier.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { normalizeName } from '../../../modules/people/core/core-text-parts/clean.js';

const OLD = 'Astra paid five silver and signed the Guild roll.';
const NEW = 'Astra brought both pairs of bog-hound ears back.';
const UNDATED = 'Met before the stamps existed.';
const DOSSIER = {
  id: 'np_pella', name: 'Pella', gender: 'Female', lifeState: 'alive', lastSeenTurn: 41,
  memories: [UNDATED, OLD, NEW],
  memoryStamps: { [normalizeName(OLD)]: { m: 3, d: 'Oct 1, 08:45' }, [normalizeName(NEW)]: { m: 6, d: 'Oct 1, 11:00', s: 'r6' } },
  fieldChangeMessages: { mood: 5, location: 4 },
};
const METERS = { recent: [
  { at: 'r6', n: 6, date: 'Oct 1, 11:00', mv: { trust: 2 }, held: false, why: 'you brought both pairs of ears back' },
  { at: 'r4', n: 4, date: 'Oct 1, 09:30', ask: { trust: 2 }, held: true, note: 'on duty, so one step is all it moves', why: 'you tried to hurry the clerk' },
  { at: 2, date: 'Oct 1, 08:30', ask: { desire: 1 }, held: true, note: 'too soon after meeting' },
] };
const CAST = { key: 'np_pella', mood: { word: 'tired', valence: 0, energy: -1, control: 0, log: [
  { n: 5, date: 'Oct 1, 10:00', a: -1, why: 'a long morning of red-cord trouble at the counter' },
  { n: null, date: 'Oct 1, 08:45', v: 1, d: -1, why: '' },
] } };

test('memories show the stamp\'s story date and reply, newest first; one without a stamp shows no date and no Day link', () => {
  const vm = selectDossier({ dossier: DOSSIER });
  assert.deepEqual(vm.past, [
    { date: 'Oct 1, 11:00', text: NEW, dayRef: 'Oct 1, 11:00', reply: 6 },
    { date: 'Oct 1, 08:45', text: OLD, dayRef: 'Oct 1, 08:45', reply: 3 },
    { date: '', text: UNDATED, dayRef: null },
  ]);
  assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
});

test('a stamp with a reply but no date gives the reply only; a broken stamp gives nothing', () => {
  const vm = selectDossier({ dossier: { ...DOSSIER, memories: [OLD, NEW], memoryStamps: { [normalizeName(OLD)]: { m: 2 }, [normalizeName(NEW)]: { m: 'x', d: 'Oct 9' } } } });
  assert.deepEqual(vm.past, [{ date: '', text: NEW, dayRef: null }, { date: '', text: OLD, dayRef: null, reply: 2 }]);
});

test('meter changes carry their reply and, when held back, why it moved less', () => {
  const vm = selectDossier({ dossier: DOSSIER, meters: METERS });
  assert.deepEqual(vm.changes.map(c => [c.meter, c.delta, c.reply, c.heldBack, c.why, c.note]), [
    ['trust', 2, 6, false, 'you brought both pairs of ears back', undefined],
    ['trust', 2, 4, true, 'you tried to hurry the clerk', 'on duty, so one step is all it moves'],
    ['desire', 1, undefined, true, 'too soon after meeting', undefined],
  ]);
  assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
});

test('the mood history: reply, date, each axis moved and the recorded reason (empty when none); absent without a log', () => {
  const vm = selectDossier({ dossier: DOSSIER, cast: CAST });
  assert.deepEqual(vm.moodChanges, [
    { reply: 5, date: 'Oct 1, 10:00', moves: [{ axis: 'energy', delta: -1 }], why: 'a long morning of red-cord trouble at the counter' },
    { reply: null, date: 'Oct 1, 08:45', moves: [{ axis: 'feeling', delta: 1 }, { axis: 'control', delta: -1 }], why: '' },
  ]);
  assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
  assert.equal('moodChanges' in selectDossier({ dossier: DOSSIER, cast: { mood: { word: 'tired' } } }), false);
});

test('the last reply is the highest recorded reply (stamps, field changes, meter rows, mood history), never the scan counter', () => {
  assert.equal(selectDossier({ dossier: DOSSIER }).lastReply, 6);
  assert.equal(selectDossier({ dossier: { ...DOSSIER, memoryStamps: {} } }).lastReply, 5);
  assert.equal(selectDossier({ dossier: { ...DOSSIER, memoryStamps: {} }, meters: { recent: [{ n: 9, date: '', mv: { trust: 1 }, held: false }] } }).lastReply, 9);
  const bare = selectDossier({ dossier: { id: 'x', name: 'X', lifeState: 'alive', lastSeenTurn: 41 } });
  assert.equal('lastReply' in bare, false);
});
