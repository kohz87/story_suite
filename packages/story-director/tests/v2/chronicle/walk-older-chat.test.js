// The day walk on an older chat's receipts (clock receipts told before `kind`), in the order REVCCB probe 10 A logged them.
// F1 and F3 are right; the mixed case is the documented older-chat limit (the walk stays a day off until the next set line).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { walkDays } from '../../../src/v2/chronicle/days.js';

const D = 1440;
let id = 0;
const r = (index, type, data, rev) => ({ index, receipt: { id: `r${++id}`, type, module: 'story-director', rev, data } });
const place = (index, name, rev) => ({ index, receipt: { id: `r${++id}`, type: 'capture.place', module: 'story-director', rev, data: { name }, summary: name } });
const run = list => {
    const w = walkDays(list);
    const at = {};
    for (const [day, rs] of w.days) for (const x of rs) if (x.data?.name) at[x.data.name] = day;
    return { at, end: Math.floor(w.minutes / D) };
};

test('F1 in an older chat: an edit added +1 day, the later reply has no time line: it is filed on day 1', () => {
    const out = run([
        r(0, 'capture.time', { minutes: 1080, from: 1020 }, 1), place(0, 'Harrow', 1), r(0, 'time.settle', { minutes: 1080, from: 1020 }, 2),
        r(2, 'capture.time', { minutes: 1080 + D, from: 1080, kind: 'move' }, 9), r(2, 'time.settle', { minutes: 1080, from: 1080 }, 3),
        place(4, 'Frostgate', 4), r(4, 'time.settle', { minutes: 1080 + D, from: 1080 }, 10),
    ]);
    assert.deepEqual(out.at, { Harrow: 0, Frostgate: 1 });
    assert.equal(out.end, 1);
});

test('F3 in an older chat: the edit removed the only clock line, so the later reply stays on day 0', () => {
    const out = run([
        r(0, 'capture.time', { minutes: 1080, from: 1020 }, 1), place(0, 'Harrow', 1), r(0, 'time.settle', { minutes: 1080, from: 1020 }, 2),
        r(2, 'time.settle', { minutes: 1080 + D, from: 1080 }, 3), place(4, 'Frostgate', 4), r(4, 'time.settle', { minutes: 1080, from: 1080 + D }, 10),
    ]);
    assert.deepEqual(out.at, { Harrow: 0, Frostgate: 0 });
    assert.equal(out.end, 0);
});

test('mixed older-chat case (documented limit): an old duration with no kind told before the edit leaves later durations a day off', () => {
    const out = run([
        r(0, 'capture.time', { minutes: 1080, from: 1020 }, 1), place(0, 'Harrow', 1), r(0, 'time.settle', { minutes: 1080, from: 1020 }, 2),
        r(2, 'capture.time', { minutes: 1080 + D, from: 1080, kind: 'move' }, 9), r(2, 'time.settle', { minutes: 1080, from: 1080 }, 3),
        r(4, 'capture.time', { minutes: 1140, from: 1080 }, 4), place(4, 'Frostgate', 4), r(4, 'time.settle', { minutes: 1140 + D, from: 1080 }, 10),
        r(6, 'capture.time', { minutes: 1200 + D, from: 1140 + D, kind: 'move' }, 11), place(6, 'Redmoor', 11), r(6, 'time.settle', { minutes: 1200 + D, from: 1140 + D }, 12),
    ]);
    // A fresh telling (and the state) puts both on day 1; the walk is a day off until the next set line.
    assert.deepEqual(out.at, { Harrow: 0, Frostgate: 0, Redmoor: 0 });
    assert.equal(out.end, 0);
});
