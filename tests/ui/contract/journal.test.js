import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { JOURNAL_SHAPE } from '../../../ui/contract/journal.js';
import { buildJournal } from '../../../ui/fixtures/journal.js';

describe('JOURNAL_SHAPE', () => {
  it('accepts the default, story-only and empty fixtures', () => {
    for (const opts of [{}, { rpg: false }, { empty: true }]) {
      assert.deepEqual(checkShape(buildJournal(opts), JOURNAL_SHAPE), []);
    }
  });

  it('allows a quest with no due date and no giver id', () => {
    const vm = buildJournal();
    const hound = vm.quests.find(q => q.id === 'hound');
    assert.equal(hound.due, null);
    assert.equal(hound.giver.personId, null);
    assert.deepEqual(checkShape(vm, JOURNAL_SHAPE), []);
  });

  it('rejects an unknown due state, closed outcome and upcoming tone', () => {
    const vm = buildJournal();
    vm.quests[0].due = { date: 'x', rel: 'y', state: 'overdue' };
    vm.closed[0].outcome = 'won';
    vm.upcoming[0].tone = 'loud';
    const errors = checkShape(vm, JOURNAL_SHAPE);
    assert.equal(errors.length, 3);
    assert.ok(errors.some(e => e.startsWith('quests[0].due.state')));
    assert.ok(errors.some(e => e.startsWith('closed[0].outcome')));
    assert.ok(errors.some(e => e.startsWith('upcoming[0].tone')));
  });

  it('rejects a missing calendar today and a non-array days list', () => {
    const vm = buildJournal();
    delete vm.calendar.today;
    vm.days = {};
    const errors = checkShape(vm, JOURNAL_SHAPE);
    assert.ok(errors.some(e => e.startsWith('calendar.today')));
    assert.ok(errors.some(e => e.startsWith('days: expected array')));
  });

  it('rejects a difficulty outside easy, normal, hard', () => {
    const vm = buildJournal();
    vm.quests[0].difficulty = 'brutal';
    assert.equal(checkShape(vm, JOURNAL_SHAPE).length, 1);
  });
});
