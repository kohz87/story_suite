// The note's walk starts from the clock and scene the receipts up to the cursor say (an edit that moved the scene is followed; an edit's clock change
// is not — see the known limit), from the note's stored ones where those receipts say nothing; and a `gap.through` naming a reply that
// was deleted falls back to the revision `gap.rev`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noteFactsQuery } from '../../../src/v2/chronicle/queries.js';
import { noteCommand } from '../../../src/v2/chronicle/digest-parts/note.js';
import { dayOf } from '../../../src/v2/chronicle/days.js';

const DAY0 = 438445 * 1440 + 600;
const DAY1 = DAY0 + 1440;
const at = (id, rev, minutes) => ({ index: 1, receipt: { id, rev, type: 'capture.time', summary: 'Time', data: { minutes } } });
const step = (id, rev, text = 'went on') => ({ index: 2, receipt: { id, rev, type: 'capture.quest', summary: `Director: ${text}`, data: { thread: 'th_q' } } });
const scene = (id, rev, present) => ({ index: 1, receipt: { id, rev, type: 'capture.present', summary: 'Present', data: { present } } });
const days = plan => plan.entries.map(item => item.day - 438445);

test('the walk starts on the clock the edited receipts up to the cursor set, not the note\'s stored one', () => {
    // The kept note (stored: day 0) sits after its reply's edited receipts, which now move the clock a day.
    const receipts = [at('a', 1, DAY0), at('b', 9, DAY1), { index: 1, receipt: { id: 'note', rev: 3, type: 'chronicle.note', summary: '', data: {} } }, step('c', 10)];
    const plan = noteFactsQuery({}, { through: 'note', after: 3, minutes: DAY0 }, { receipts: () => receipts });
    assert.deepEqual(days(plan), [1]);
    assert.equal(dayOf(plan.minutes), 438446);
});

test('the walk starts from the stored clock when those receipts hold none (data trimmed away)', () => {
    const receipts = [{ index: 1, receipt: { id: 'a', rev: 1, type: 'capture.time', summary: 'Time', data: {} } }, step('note', 3), step('c', 10)];
    const plan = noteFactsQuery({}, { through: 'note', after: 3, minutes: DAY0 }, { receipts: () => receipts });
    assert.deepEqual(days(plan), [0]);
});

test('the walk starts from the scene those receipts leave, else from the stored one', () => {
    const edited = [scene('a', 1, ['Mira']), step('note', 3), step('c', 10)];
    assert.deepEqual(noteFactsQuery({}, { through: 'note', minutes: DAY0, present: ['Old'] }, { receipts: () => edited }).present, ['Mira']);
    const plain = [step('note', 3), step('c', 10)];
    assert.deepEqual(noteFactsQuery({}, { through: 'note', minutes: DAY0, present: ['Old'] }, { receipts: () => plain }).present, ['Old']);
});

test('a revision cursor (no `through`) keeps the stored clock and scene', () => {
    const receipts = [at('a', 1, DAY1), step('c', 10)];
    const plan = noteFactsQuery({}, { after: 1, minutes: DAY0, present: ['Old'] }, { receipts: () => receipts });
    assert.deepEqual(days(plan), [0]);
    assert.deepEqual(plan.present, ['Old']);
});

test('a `gap.through` naming a deleted reply falls back to `gap.rev`', () => {
    const receipts = [step('a', 1, 'one'), step('b', 6, 'two'), step('c', 7, 'three')];
    const asked = [];
    const chronicle = { dayFacts: {}, questLog: {}, noted: [{ rev: 5, through: 'a', minutes: DAY0, from: 438445, settle: null, gap: { rev: 4, through: 'deleted', minutes: DAY0 } }] };
    const ctx = {
        cause: 'system', rev: 8, receiptId: 'rc_new', feature: () => true, draft: () => chronicle,
        query(name, args) { if (name === 'chronicle.noteFacts') { asked.push(args); return noteFactsQuery({}, args, { receipts: () => receipts }); } return null; },
        fail(code) { throw new Error(code); },
    };
    noteCommand(ctx);
    assert.equal(asked[0].through, 'deleted');
    assert.equal(asked[0].after, 4);
    assert.deepEqual(Object.values(chronicle.questLog).map(item => item.text), ['two', 'three']);
});
