import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectNow } from '../../../ui/select/now.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { ANSWERS, GEAR_VIEW, PINNED } from './recorded.js';

describe('selectNow', () => {
  const now = selectNow(ANSWERS, { torn: GEAR_VIEW, pinned: PINNED, fight: { state: 'choose' } });

  it('matches the contract', () => {
    assert.deepEqual(checkShape(now, NOW_SHAPE), []);
  });

  it('lists a fight then overdue work under needs you', () => {
    assert.deepEqual(now.needsYou.map(row => row.kind), ['fight', 'overdue']);
    assert.equal(now.needsYou[1].detail, 'Pay the guild');
  });

  it('builds today from the goal, the trip, the next date and torn gear', () => {
    assert.deepEqual(now.today.focus, { title: 'Find the caravan', detail: 'Ask at the gate' });
    assert.deepEqual(now.today.trip, { state: 'road', title: 'Auvoth', detail: 'Bluewatch → Auvoth · leg 2 of 4', progressPct: 38 });
    assert.deepEqual(now.today.dueSoon, { title: 'Pay the guild', detail: 'Goldwane 14' });
    assert.deepEqual(now.today.torn, [{ stack: 's1', name: 'Old Cloak', detail: 'torn' }]);
  });

  it('marks who is here as followed or in the party, with the scene gaps null', () => {
    assert.equal(now.here[0].followed, true);
    assert.equal(now.here[0].inParty, false);
    assert.equal(now.here[0].scene, null);
    assert.equal(now.here[0].doing, null);
  });

  it('holds back what was not applied, with its reason', () => {
    assert.equal(now.thisTurn.count, 5);
    assert.deepEqual(now.thisTurn.items.at(-1).heldBack, { asked: '+ item Moon Blade', why: 'No such item.' });
    assert.equal(now.thisTurn.items[0].heldBack, null);
  });

  it('reads you and the pinned fields', () => {
    assert.deepEqual(now.you, { look: 'a grey travel coat', position: null, condition: 'tired' });
    assert.deepEqual(now.pinned[0].fields, [{ label: 'Guild', value: '12' }, { label: 'Town', value: 'liked' }]);
  });

  it('is quiet with no answers: no cards, null gaps', () => {
    const empty = selectNow();
    assert.deepEqual(checkShape(empty, NOW_SHAPE), []);
    assert.deepEqual(empty.needsYou, []);
    assert.equal(empty.today.focus, null);
    assert.equal(empty.today.trip, null);
    assert.deepEqual(empty.thisTurn, { count: 0, items: [] });
    assert.deepEqual(empty.you, { look: null, position: null, condition: null });
  });

  it('shows a planned trip at 0 percent with when it leaves', () => {
    const planned = selectNow({ 'atlas.trip': { on: true, to: 'Auvoth', phase: 'planned', row: 'Bluewatch → Auvoth', departs: 'Goldwane 14', leg: 1, legCount: 2, fraction: 0 } });
    assert.deepEqual(planned.today.trip, { state: 'planned', title: 'Auvoth', detail: 'Bluewatch → Auvoth · leaves Goldwane 14', progressPct: 0 });
  });

  it('shows an arrived trip at 100 percent and skips one not on the road yet', () => {
    const arrived = selectNow({ 'atlas.trip': { on: true, to: 'X', phase: 'arrived', row: 'Arrived', leg: 1, legCount: 1, fraction: 0 } });
    assert.equal(arrived.today.trip.progressPct, 100);
    assert.equal(selectNow({ 'atlas.trip': { on: false, phase: '' } }).today.trip, null);
  });

  it('adds one points row from rpg.sheet (singular for one, names the members), none when nobody has points', () => {
    const rows = points => selectNow({ 'rpg.sheet': points.map((n, at) => ({ id: `m${at}`, name: `M${at}`, points: n })) }).needsYou;
    assert.deepEqual(rows([1, 0]), [{ kind: 'points', title: '1 point to spend', detail: 'M0', go: 'party' }]);
    assert.deepEqual(rows([2, 3]).map(row => [row.title, row.detail]), [['5 points to spend', 'M0, M1']]);
    assert.deepEqual(rows([0, 0]), []);
    assert.deepEqual(selectNow({ 'rpg.sheet': null }).needsYou, []);
  });
});
