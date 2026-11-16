import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { JOURNAL_SHAPE } from '../../../ui/contract/journal.js';
import { calendarOf, selectJournal } from '../../../ui/select/journal.js';

// Recorded answers, written from the real query code (the file:line is each query's definition).
const MONTHS = ['Deepfrost', 'Snowmelt', 'Seedtime', 'Greening', 'Highsun', 'Harvestide', 'Goldwane', 'Thawmonth'];
// director.calendar returns normalizeCalendar's shape: SD/calendar.js:114 (era, months [{ name, days }], week, weekOffset).
const CALENDAR = { preset: 'custom', era: 'CY', months: MONTHS.map(name => ({ name, days: 30 })), daysPerMonth: 30, leapYears: false, week: ['Firstday', 'Secondday', 'Restday'], weekOffset: 0 };
// director.time: SD/tracker/domain.js:322 ({ minutes, text, parts: { year, month from 1, day, minutes } }).
const TIME = { minutes: 123456, text: 'Goldwane 13, 611, 9:30 am', parts: { year: 611, month: 7, day: 13, minutes: 570 } };
// director.threads rows: the plain thread (domain.js:300: id, key, kind, status, summary, fields, offer, taken, ended, rev).
const thread = (id, key, fields, extra = {}) => ({ id, key, kind: 'quest', status: 'active', summary: '', fields, offer: false, taken: true, ended: null, rev: 1, ...extra });
const ACTIVE = [
  thread('th_1', 'Brann’s smith bill', { goal: 'Pay the smith for the mended mail.', step: 'Pay 30 silver', giver: 'Brann', due: 'Goldwane 12', place: 'Bluewatch' }),
  thread('th_2', 'Missing boatman', { goal: 'Find Hal the boatman.', step: 'Reach Auvoth', giver: 'Sister Temiwa', due: 'Goldwane 18', reward: '40 copper' }),
  thread('th_3', 'Bounty on the ridge hounds', { goal: 'Clear the hounds.' }),
  thread('th_4', 'An offered errand', { goal: 'Not taken yet.' }, { offer: true, taken: false }),
];
const RESOLVED = [
  thread('th_5', 'Wolf tracks', {}, { status: 'resolved', ended: { rev: 4, outcome: 'done', reason: 'Finished Goldwane 13' } }),
  thread('th_6', 'Lost goat', {}, { status: 'resolved', ended: { rev: 5, outcome: 'abandoned', reason: 'Given up Goldwane 10' } }),
  thread('th_7', 'Dock work', {}, { status: 'resolved', ended: { rev: 6, outcome: 'declined', reason: 'Declined Goldwane 11' } }),
  thread('th_8', 'Escort', {}, { status: 'resolved', ended: { rev: 7, outcome: 'superseded', reason: 'Offer lapsed' } }),
  thread('th_9', 'Odd one', {}, { status: 'resolved', ended: { rev: 8, outcome: 'mystery', reason: '' } }),
];
// director.world: SD/world/known.js:399; its upcoming rows come from knownUpcoming (:362) and are soonest first, overdue first of all.
const WORLD = {
  upcoming: [
    { kind: 'quest', name: 'Brann’s smith bill', field: 'due', when: 'Goldwane 12', inDays: -1, label: 'overdue', overdue: true, goal: '' },
    { kind: 'quest', name: 'Missing boatman', field: 'due', when: 'Goldwane 18', inDays: 5, label: 'in 5 days', overdue: false, goal: '' },
    { kind: 'event', name: 'Harvest fair', field: 'on', when: 'Goldwane 16', inDays: 3, label: 'in 3 days', overdue: false, goal: '' },
    { kind: 'holiday', name: 'Tithe day', field: '', when: 'Goldwane 30', inDays: 17, label: 'in 17 days', overdue: false, goal: '' },
    { kind: 'quest', name: 'Tomorrow thing', field: 'due', when: 'Goldwane 14', inDays: 1, label: 'tomorrow', overdue: false, goal: '' },
  ],
};
// director.world.leads: SD/world/index.js:52 ({ rows: [{ id, name, heard, heardAgo, where }], has, count }).
const LEADS = { rows: [{ id: 'th_10', name: 'Guards wanted', heard: 'On the notice board.', heardAgo: '1 day ago', where: 'notice board · Bluewatch' }], has: true, count: 1 };
// director.journal: SD/world/journal.js:284 ({ on, days: [{ day, date, today, short, happened, met, world, … }], hasDays, count, today }).
const JOURNAL = {
  on: true, hasDays: true, count: 2, today: 'Goldwane 13',
  days: [
    { day: 99, date: 'CY 611, Goldwane 13', today: true, brief: true, short: 'finished Wolf tracks.', happened: ['You finished Wolf tracks.'], met: ['Oyla'], world: ['Bandit tolls'] },
    { day: 98, date: 'Goldwane 12', today: false, brief: false, short: '', happened: [], met: [], world: [] },
  ],
};

function recorded(overrides = {}) {
  const answers = {
    'director.calendar': CALENDAR, 'director.time': TIME, 'director.world': WORLD, 'director.world.leads': LEADS,
    'director.goal': { id: 'th_2', key: 'Missing boatman', goal: 'Find Hal the boatman.', step: 'Reach Auvoth', giver: 'Sister Temiwa', due: 'Goldwane 18', taken: true },
    'director.journal': JOURNAL, ...overrides,
  };
  return (name, args) => {
    if (name === 'director.threads') return args?.status === 'resolved' ? RESOLVED : ACTIVE;
    return answers[name] ?? null;
  };
}

describe('selectJournal', () => {
  it('builds a view-model that fits the contract shape', () => {
    assert.deepEqual(checkShape(selectJournal(recorded()), JOURNAL_SHAPE), []);
  });

  it('lists open quests only, the goal first, and drops offers', () => {
    const vm = selectJournal(recorded());
    assert.deepEqual(vm.quests.map(q => q.id), ['th_2', 'th_1', 'th_3']);
    assert.equal(vm.focusId, 'th_2');
  });

  it('prefers the reader’s focus pick over the current goal', () => {
    const vm = selectJournal(recorded(), { focusId: 'th_3' });
    assert.equal(vm.focusId, 'th_3');
    assert.equal(vm.quests[0].id, 'th_3');
  });

  it('ignores a focus pick that is not an open quest', () => {
    const vm = selectJournal(recorded({ 'director.goal': null }), { focusId: 'gone' });
    assert.equal(vm.focusId, null);
  });

  it('reads a quest’s step, giver, place and reward, and nulls the gaps', () => {
    const q = selectJournal(recorded()).quests.find(x => x.id === 'th_2');
    assert.equal(q.title, 'Missing boatman');
    assert.equal(q.summary, 'Find Hal the boatman.');
    assert.deepEqual([q.step, q.stepIndex, q.stepCount, q.steps], ['Reach Auvoth', 0, 1, ['Reach Auvoth']]);
    assert.deepEqual(q.giver, { personId: null, name: 'Sister Temiwa' });
    assert.equal(q.reward, '40 copper');
    assert.deepEqual([q.difficulty, q.trip, q.place], [null, null, null]);
  });

  it('gives a quest with no step an empty step list', () => {
    const q = selectJournal(recorded()).quests.find(x => x.id === 'th_3');
    assert.deepEqual([q.step, q.stepCount, q.steps, q.due, q.reward], ['', 0, [], null, null]);
  });

  it('takes a quest’s due date from the upcoming rows: late, then a plain one', () => {
    const quests = selectJournal(recorded()).quests;
    assert.deepEqual(quests.find(q => q.id === 'th_1').due, { date: 'Goldwane 12', rel: 'overdue', state: 'late' });
    assert.deepEqual(quests.find(q => q.id === 'th_2').due, { date: 'Goldwane 18', rel: 'in 5 days', state: '' });
  });

  it('falls back to the due field when the world answer has no row', () => {
    const vm = selectJournal(recorded({ 'director.world': null }));
    assert.deepEqual(vm.quests.find(q => q.id === 'th_1').due, { date: 'Goldwane 12', rel: '', state: '' });
    assert.deepEqual(vm.upcoming, []);
  });

  it('hides rewards when the RPG is off', () => {
    const vm = selectJournal(recorded(), { rpg: false });
    assert.equal(vm.rpg, false);
    assert.equal(vm.quests.find(q => q.id === 'th_2').reward, null);
  });

  it('maps closed quests newest first and leaves out an unknown outcome', () => {
    const vm = selectJournal(recorded());
    assert.deepEqual(vm.closed.map(c => c.outcome), ['lapsed', 'declined', 'gaveup', 'done']);
    assert.deepEqual(vm.closed[3], { title: 'Wolf tracks', outcome: 'done', detail: 'Finished Goldwane 13', paid: null });
  });

  it('turns lead rows into leads with the unknown parts empty', () => {
    assert.deepEqual(selectJournal(recorded()).leads, [{ title: 'Guards wanted', from: '', where: 'notice board · Bluewatch', lapses: '' }]);
  });

  it('groups coming up: late, soon, week, later, with a tone and a kind word', () => {
    const up = selectJournal(recorded()).upcoming;
    assert.deepEqual(up.map(u => u.group), ['late', 'week', 'week', 'later', 'soon']);
    assert.deepEqual(up.map(u => u.tone), ['bad', 'warn', 'info', 'info', 'warn']);
    assert.deepEqual(up[0], { group: 'late', name: 'Brann’s smith bill', date: 'Goldwane 12', month: 6, day: 12, rel: 'overdue', kind: 'quest due', glyph: '⚑', tone: 'bad' });
    assert.equal(up[2].kind, 'event you heard of');
    assert.equal(up[3].kind, 'holiday');
  });

  it('builds days with the date, a line and the met and world lists', () => {
    const days = selectJournal(recorded()).days;
    assert.equal(days.length, 2);
    assert.deepEqual([days[0].month, days[0].day], [6, 13]);
    assert.equal(days[0].line, 'CY 611, Goldwane 13: finished Wolf tracks.');
    assert.deepEqual([days[0].met, days[0].world, days[0].happened], [['Oyla'], ['Bandit tolls'], ['You finished Wolf tracks.']]);
    assert.equal(days[1].line, 'Goldwane 12');
    assert.deepEqual([days[0].fights, days[0].places, days[0].stageMoves, days[0].money], [0, [], [], { in: null, out: null }]);
  });

  it('has no days while the day digest is off', () => {
    const vm = selectJournal(recorded({ 'director.journal': { on: false, days: [], hasDays: false, count: 0, today: '' } }));
    assert.deepEqual(vm.days, []);
  });

  it('returns empty lists and a null calendar when every query is absent', () => {
    const vm = selectJournal(() => null);
    assert.deepEqual([vm.quests, vm.closed, vm.leads, vm.days, vm.upcoming, vm.planned], [[], [], [], [], [], []]);
    assert.deepEqual([vm.calendar, vm.focusId, vm.rpg], [null, null, true]);
  });
});

describe('calendarOf', () => {
  it('lists the months of the current year, the weekday names, the era and today', () => {
    const c = calendarOf(CALENDAR, TIME);
    assert.equal(c.months.length, 8);
    assert.deepEqual(c.months[6], { name: 'Goldwane', length: 30, firstWeekday: 0, year: 611 });
    assert.deepEqual(c.weekdays[2], { short: 'R', name: 'Restday' });
    assert.equal(c.era, 'CY');
    assert.deepEqual(c.today, { month: 6, day: 13 });
    assert.equal(c.start, null);
  });

  it('is null while the story clock is not set or there is no calendar', () => {
    assert.equal(calendarOf(CALENDAR, { minutes: null, text: '', parts: null }), null);
    assert.equal(calendarOf(null, TIME), null);
    assert.equal(calendarOf({ months: [] }, TIME), null);
  });

  it('gives no weekday names for a calendar without a week', () => {
    assert.deepEqual(calendarOf({ ...CALENDAR, week: [] }, TIME).weekdays, []);
  });
});
