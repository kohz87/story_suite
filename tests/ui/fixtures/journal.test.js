import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildJournal } from '../../../ui/fixtures/journal.js';

describe('buildJournal', () => {
  it('default: four quests with the boatman in focus first, three leads, five closed', () => {
    const vm = buildJournal();
    assert.equal(vm.rpg, true);
    assert.deepEqual(vm.quests.map(q => q.id), ['boat', 'over', 'harb', 'hound']);
    assert.equal(vm.focusId, 'boat');
    assert.equal(vm.leads.length, 3);
    assert.equal(vm.closed.length, 5);
    assert.equal(vm.quests[0].step, 'Reach Auvoth and ask at the docks');
    assert.equal(vm.quests[0].stepCount, 3);
    assert.equal(vm.quests[0].reward, '40 copper');
  });

  it('focus changes order only', () => {
    const vm = buildJournal({ focus: 'harb' });
    assert.equal(vm.quests[0].id, 'harb');
    assert.equal(vm.focusId, 'harb');
    assert.equal(vm.quests.length, 4);
    assert.equal(buildJournal({ focus: 'nope' }).focusId, null);
  });

  it('story only: no reward, difficulty or closed payouts', () => {
    const vm = buildJournal({ rpg: false });
    assert.equal(vm.rpg, false);
    for (const q of vm.quests) {
      assert.equal(q.reward, null);
      assert.equal(q.difficulty, null);
    }
    assert.ok(vm.closed.every(c => c.paid === null));
    assert.equal(vm.quests.length, 4);
  });

  it('empty: no quests, leads, closed, days or upcoming, but the calendar stays', () => {
    const vm = buildJournal({ empty: true });
    assert.deepEqual([vm.quests, vm.leads, vm.closed, vm.days, vm.planned, vm.upcoming], [[], [], [], [], [], []]);
    assert.equal(vm.focusId, null);
    assert.equal(vm.calendar.today.day, 13);
  });

  it('calendar: 50 months over CY 611-615, ten month names, seven weekdays, today and start', () => {
    const { calendar } = buildJournal();
    assert.equal(calendar.months.length, 50);
    assert.equal(calendar.months[6].name, 'Goldwane');
    assert.equal(calendar.months[49].year, 615);
    assert.equal(calendar.weekdays.length, 7);
    assert.equal(calendar.era, 'CY');
    assert.deepEqual(calendar.today, { month: 6, day: 13 });
    assert.deepEqual(calendar.start, { month: 6, day: 9 });
  });

  it('days: newest first, fixed one-line summary, no clock times', () => {
    const { days } = buildJournal();
    assert.deepEqual(days.map(d => d.day), [13, 12, 11, 10, 9]);
    assert.equal(days[0].line, 'Goldwane 13: took on Word to the harbour; finished Wolf tracks on the ridge; 1 silver in, 8 copper out; 1 NPC stage moved; 1 world event.');
    assert.equal(days[3].line, 'Goldwane 10: to Hollin’s Reach; gave up Lost goat at Hollin’s Reach.');
    assert.equal(days[2].line, 'Goldwane 11: Sister Temiwa gave you a silver ring.');
    for (const d of days) assert.doesNotMatch(d.line, /\d:\d\d/);
  });

  it('days: records are copies, so changing one leaves the next call untouched', () => {
    const a = buildJournal();
    a.days[0].happened.push('x');
    a.quests[0].steps.push('x');
    const b = buildJournal();
    assert.equal(b.days[0].happened.length, 4);
    assert.equal(b.quests[0].steps.length, 3);
  });

  it('upcoming: overdue first, dates only, groups late, soon, week, later', () => {
    const { upcoming } = buildJournal();
    assert.deepEqual(upcoming.map(u => u.group), ['late', 'soon', 'week', 'week', 'later']);
    assert.equal(upcoming[0].tone, 'bad');
    assert.equal(upcoming[0].date, 'Goldwane 12');
    assert.equal(upcoming[2].rel, 'in 3 days');
  });
});
