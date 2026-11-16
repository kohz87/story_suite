// The one clock stepper (days-parts/clock-step.js) and the walk on it: a move is relative, a set is absolute, a settle only starts a clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stepClock } from '../../../../modules/world/chronicle/days-parts/clock-step.js';
import { walkDays } from '../../../../modules/world/chronicle/days.js';
import { noteFactsQuery } from '../../../../modules/world/chronicle/queries.js';

const DAY = 1440;
const r = (type, minutes, extra = {}, rev = 1) => ({ type, rev, module: 'story-director', summary: 'x', data: { minutes, ...extra } });
const move = (minutes, from) => r('capture.time', minutes, { from, kind: 'move' });
const set = (minutes, from) => r('capture.time', minutes, { from, kind: 'set' });

test('a move is relative: it adds what it moved, whatever clock it was told at', () => {
    assert.equal(stepClock(5 * DAY, move(100 + 60, 100)), 5 * DAY + 60);
    assert.equal(stepClock(5 * DAY, r('director.advance', 100 + 30, { from: 100 })), 5 * DAY + 30);
});
test('a set is absolute; a receipt of no kind is a set (told before kinds)', () => {
    assert.equal(stepClock(5 * DAY, set(7 * DAY, 100)), 7 * DAY);
    assert.equal(stepClock(5 * DAY, r('capture.time', 7 * DAY, { from: 100 })), 7 * DAY);
    assert.equal(stepClock(5 * DAY, r('director.clock', 8 * DAY)), 8 * DAY);
    assert.equal(stepClock(5 * DAY, r('director.seed', 9 * DAY)), 9 * DAY);
});
test('a settle only starts a clock that is not started; after that it moves nothing', () => {
    assert.equal(stepClock(null, r('time.settle', 3 * DAY, { from: 1 })), 3 * DAY);
    assert.equal(stepClock(5 * DAY, r('time.settle', 3 * DAY, { from: 1 })), 5 * DAY);
});
test('a line "(not used)" (a move with no from) moves nothing; the first clock receipt starts the clock either way', () => {
    assert.equal(stepClock(5 * DAY, r('capture.time', 99, { kind: 'move' })), 5 * DAY);
    assert.equal(stepClock(null, move(7 * DAY, 3)), 7 * DAY);
});
test('data trimmed away or another module\'s receipt leaves the clock as it is', () => {
    assert.equal(stepClock(5 * DAY, { type: 'capture.time', data: {} }), 5 * DAY);
    assert.equal(stepClock(5 * DAY, { type: 'capture.time', module: 'other', data: { minutes: 1 } }), 5 * DAY);
    assert.equal(stepClock(5 * DAY, { type: 'capture.place', data: { minutes: 1 } }), 5 * DAY);
});
test('a joined line\'s receipt (a set, then a move, from the clock before the command) steps as a set', () => {
    assert.equal(stepClock(5 * DAY, set(8 * DAY + 120, 100)), 8 * DAY + 120);
});

test('walkDays: a receipt told before an earlier edit is filed on the walked day, not its stored one', () => {
    // R1 sets day 0 (stored d0); R2 (edited) moved +1 day: stored d1 minutes; R3, told before the edit, +1 hour from d0 (stored d0@60+... ).
    const list = [set(0 * DAY + 600, null), move(1 * DAY + 600, 600), r('time.settle', 600, { from: null }, 3), move(660, 600)];
    const out = list.map(receipt => ({ receipt }));
    // The edit moved R2's op but not R3's stored receipt: R3 (from 600, minutes 660) now sits a day later.
    const walk = walkDays(out);
    assert.equal(walk.minutes, 1 * DAY + 660);
    assert.deepEqual([...walk.days.keys()], [0, 1]);
});

test('walkDays: the settle jump is the walked clock at the settle before it, to the walked clock now; settleAt hands it on', () => {
    const settle = minutes => r('time.settle', minutes, { from: 5 });
    const a = walkDays([set(DAY, null), settle(DAY), move(2 * DAY, DAY), settle(900 * DAY)].map(receipt => ({ receipt })));
    assert.deepEqual(a.settle, { from: DAY, to: 2 * DAY });
    assert.equal(a.settleAt, 2 * DAY);
    const b = walkDays([move(3 * DAY, 2 * DAY), settle(900 * DAY)].map(receipt => ({ receipt })), { minutes: 2 * DAY, settleAt: a.settleAt });
    assert.deepEqual(b.settle, { from: 2 * DAY, to: 3 * DAY });
    // The first settle in sight keeps its own `from` (nothing walked before it).
    assert.deepEqual(walkDays([settle(DAY)].map(receipt => ({ receipt }))).settle, { from: 5, to: DAY });
});

test('noteFacts: the last settle jump starts from the walked clock of the settle before the cursor (since() hands settleAt on)', () => {
    const rc = (id, type, minutes, extra = {}, rev = 1) => ({ receipt: { id, type, rev, module: 'story-director', summary: 'x', data: { minutes, ...extra } } });
    // Told at d0 10:00; the second reply moved +1 hour; an edit then added a day to it. The settle of the third reply (stored `from` the
    // pre-edit clock) and the note's cursor come after; the reply after the cursor moves +1 hour and is settled.
    const T = 1000;
    const all = [
        rc('a', 'capture.time', T, { kind: 'set' }), rc('b', 'time.settle', T, { from: null }, 2),
        rc('c', 'capture.time', T + 60, { from: T, kind: 'move' }, 3), rc('d', 'capture.time', T + 60 + DAY, { from: T + 60, kind: 'move' }, 3),
        rc('e', 'time.settle', T + 60, { from: T }, 4), { receipt: { id: 'f', type: 'chronicle.note', rev: 4, summary: '', data: {} } },
        rc('g', 'capture.time', T + 120, { from: T + 60, kind: 'move' }, 5), rc('h', 'time.settle', T + 120, { from: T + 60 }, 6),
    ];
    const out = noteFactsQuery({ domains: {} }, { through: 'f', minutes: 0 }, { receipts: () => all });
    // Walked: T → +60 → +1 day = T + 60 + DAY at the settle `e`; then +60 more at `h`: the jump is one hour, not the pre-edit day-and-an-hour from the stored `from`.
    assert.deepEqual(out.settle, { from: T + 60 + DAY, to: T + 120 + DAY });
    assert.equal(out.minutes, T + 120 + DAY);
});

// An anchored set (`kind` 'same' | 'after'): the walked clock mirrors Story Block's replay of it (as stored on the clock it was told on, else its offset in whole days).
const anchored = (kind, minutes, from, extra = {}) => r('capture.time', minutes, { from, kind, ...extra });
test('an anchored set is as stored on the clock it was told at, and keeps its offset in days on another', () => {
    const face = anchored('same', 2 * DAY + 1290, 2 * DAY + 1140);   // "~ time 9:30 pm" told at 7 pm
    assert.equal(stepClock(2 * DAY + 1140, face), 2 * DAY + 1290);
    assert.equal(stepClock(3 * DAY + 1140, face), 3 * DAY + 1290, 'a day later');
    assert.equal(stepClock(1 * DAY + 600, face), 1 * DAY + 1290, 'a day earlier, and earlier in the day');
    const skip = anchored('after', 3 * DAY + 540, 2 * DAY + 1140);  // "! time next morning" told at 7 pm
    assert.equal(stepClock(2 * DAY + 1140, skip), 3 * DAY + 540);
    assert.equal(stepClock(4 * DAY + 1140, skip), 5 * DAY + 540);
});
test('a "same" face never lands below the clock; an "after" skip lands after it', () => {
    assert.equal(stepClock(2 * DAY + 1380, anchored('same', 2 * DAY + 1290, 2 * DAY + 1140)), 2 * DAY + 1380, 'the clock stands past the face: it stays');
    assert.equal(stepClock(2 * DAY + 1380, anchored('after', 2 * DAY + 1290, 2 * DAY + 1140)), 3 * DAY + 1290, 'a bare ! time past it is the next day');
});
test('a refused face (the clock stayed, `to` is the face it asked for) lands once the clock is before it', () => {
    const refused = anchored('same', 2 * DAY + 1140, 2 * DAY + 1140, { to: 2 * DAY + 480 });   // "~ time 8:00 am" told at 7 pm
    assert.equal(stepClock(2 * DAY + 1140, refused), 2 * DAY + 1140, 'still refused on the clock it was told at');
    assert.equal(stepClock(3 * DAY + 300, refused), 3 * DAY + 480, 'at 5 am the next day it is 8 am');
    assert.equal(stepClock(3 * DAY + 1140, refused), 3 * DAY + 1140, 'at 7 pm the next day it is refused again');
});
test('an anchored receipt with no `from` moves nothing', () => {
    assert.equal(stepClock(5 * DAY, r('capture.time', 99, { kind: 'same' })), 5 * DAY);
});
