// Journal witnesses in the view: the day's lines name who was there (only with the switch on), a person's Past lists the lines they were
// present for after NPC State's own memories (never on a day it stamped a memory), and with the switch off the view is as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { JOURNAL_SHAPE } from '../../../ui/contract/journal.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { selectJournal } from '../../../ui/select/journal.js';
import { selectDossier } from '../../../ui/select/dossier.js';
import { normalizeName } from '../../../modules/people/core/core-text-parts/clean.js';
import { installFakeDom } from '../helpers/dom.js';
import { buildJournal } from '../../../ui/fixtures/journal.js';
import { dayPanel } from '../../../ui/tabs/journal/day.js';

const JOURNAL = { on: true, hasDays: true, count: 1, today: 'June 4', days: [{ day: 1, date: 'June 3, 1200', today: false, brief: false, short: '', happened: ['The gate opened.', 'Mira signed.'], happenedWho: [['Mira', 'Old Tom'], []], met: [], world: [] }] };
const read = on => (name) => {
  if (name === 'director.journal') return JOURNAL;
  if (name === 'journal.witnesses') return { on };
  if (name === 'director.calendar') return { preset: 'custom', era: 'CY', months: [{ name: 'June', days: 30 }], daysPerMonth: 30, leapYears: false, week: ['A'], weekOffset: 0 };
  if (name === 'director.time') return { minutes: 1000, text: 'June 4', parts: { year: 1200, month: 1, day: 4, minutes: 0 } };
  return name === 'director.threads' ? [] : null;
};

test('the Journal carries who was there per line only with the switch on', () => {
  const on = selectJournal(read(true));
  assert.deepEqual(on.days[0].happenedWho, [['Mira', 'Old Tom'], []]);
  assert.deepEqual(checkShape(on, JOURNAL_SHAPE), []);
  const off = selectJournal(read(false));
  assert.ok(!('happenedWho' in off.days[0]));
  assert.deepEqual(checkShape(off, JOURNAL_SHAPE), []);
});

test('the day panel shows "with …" under a line that has witnesses (at most three, then +N)', () => {
  installFakeDom();
  const j = buildJournal();
  const rec = j.days.find(d => d.happened?.length);
  rec.happenedWho = rec.happened.map((_, i) => (i === 0 ? ['A', 'B', 'C', 'D', 'E'] : []));
  const el = dayPanel(j, rec.month, rec.day);
  const withs = el.querySelectorAll('small.with');
  assert.equal(withs.length, 1);
  assert.equal(withs[0].textContent, 'with A, B, C +2');
});

const DOSSIER = { id: 'np_mira', name: 'Mira', gender: 'Female', lifeState: 'alive', memories: ['Mira paid the toll.'], memoryStamps: { [normalizeName('Mira paid the toll.')]: { m: 2, d: 'June 3, 1200, 08:45' } } };
const LINES = [{ date: 'June 3, 1200', text: 'The gate opened.' }, { date: 'June 2, 1200', text: 'Rain came in.' }];

test('Past: witnessed lines follow NPC State\'s memories, skip a day it stamped, and carry no reply; off adds nothing', () => {
  const vm = selectDossier({ dossier: DOSSIER, witnessed: LINES });
  assert.deepEqual(vm.past.map(item => item.text), ['Mira paid the toll.', 'Rain came in.']);
  assert.equal(vm.past[1].date, 'June 2, 1200');
  assert.ok(!('reply' in vm.past[1]));
  assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
  assert.deepEqual(selectDossier({ dossier: DOSSIER, witnessed: [] }).past, selectDossier({ dossier: DOSSIER }).past);
});
