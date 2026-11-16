// The note's cursor and the quest history's keys, unit by unit: `chronicle.noteFacts` reads from the receipt `through`
// names (in chat order) and falls back to the revision `after` for an older state or a receipt that is gone; the note
// writes its own receipt ID and passes an older `noted` (no `through`) on by revision; the hook still asks by revision; the
// validator takes the old and new shapes; `chronicle.threadOutcome` keys its line by reply, keeps its revision, and is
// never overwritten by the note's line of the same revision.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noteFactsQuery } from '../../../../modules/world/chronicle/queries.js';
import { noteCommand, noteCommands } from '../../../../modules/world/chronicle/digest-parts/note.js';
import { questLogOf, validateDays } from '../../../../modules/world/chronicle/days.js';
import { threadOutcome } from '../../../../modules/world/chronicle/thread-outcome.js';
import { slotValue } from '../../../../modules/rpg/slot.js';

const line = (id, rev, text) => ({ index: 2, receipt: { id, rev, type: 'capture.quest', summary: `Director: ${text}`, data: { thread: 'th_q' } } });
// Chat order as a Re-read leaves it: the kept note `rc_note` (rev 5) sits after its reply's renumbered lines (revs 9, 10).
const RECEIPTS = [line('rc_a', 1, 'one'), line('rc_b', 9, 'two'), line('rc_c', 10, 'three'), { index: 2, receipt: { id: 'rc_note', rev: 5, type: 'chronicle.note', summary: '', data: {} } }, line('rc_d', 11, 'four')];
const tools = { receipts: () => RECEIPTS };
const texts = plan => plan.quests.map(item => item.text);

test('noteFacts reads after the receipt `through` names, in chat order, whatever the revisions', () => {
    assert.deepEqual(texts(noteFactsQuery({}, { through: 'rc_note', after: 5 }, tools)), ['Director: four']);
    assert.deepEqual(texts(noteFactsQuery({}, { through: 'rc_d', after: 11 }, tools)), []);
});

test('noteFacts reads by revision for an older state (no `through`) or a receipt that is gone', () => {
    const byRev = ['Director: two', 'Director: three', 'Director: four'];
    assert.deepEqual(texts(noteFactsQuery({}, { after: 5 }, tools)), byRev);
    assert.deepEqual(texts(noteFactsQuery({}, { through: 'rc_gone', after: 5 }, tools)), byRev);
    assert.deepEqual(texts(noteFactsQuery({}, {}, tools)), ['Director: one', ...byRev]);
});

function noteCtx(noted, { receiptId = 'rc_new', rev = 12, feature = () => true } = {}) {
    const chronicle = { dayFacts: {}, questLog: {}, noted };
    const asked = [];
    const ctx = {
        cause: 'system', rev, receiptId, feature,
        draft: () => chronicle,
        query(name, args) { if (name === 'chronicle.noteFacts') { asked.push(args); return noteFactsQuery({}, args, tools); } return null; },
        fail(code) { throw new Error(code); },
    };
    return { ctx, chronicle, asked };
}

test('an older `noted` (a revision, no `through`) still reads, by revision; the note then writes its own receipt ID', () => {
    const { ctx, chronicle, asked } = noteCtx([{ rev: 5, minutes: null, from: null, settle: null }]);
    noteCommand(ctx);
    assert.equal(asked[0].after, 5);
    assert.equal('through' in asked[0], false);
    assert.deepEqual(Object.values(chronicle.questLog).map(entry => entry.text), ['two', 'three', 'four']);
    assert.equal(slotValue(chronicle.noted).through, 'rc_new');
    assert.equal(slotValue(chronicle.noted).rev, 12);
    assert.deepEqual(validateDays(chronicle), []);
});

test('a `noted` with `through` reads from that receipt; with the digest off the gap keeps it too', () => {
    const { ctx, chronicle, asked } = noteCtx([{ rev: 5, through: 'rc_note', minutes: null, from: null, settle: null }], { feature: () => false });
    noteCommand(ctx);
    assert.equal(asked[0].through, 'rc_note');
    assert.deepEqual(Object.values(chronicle.questLog).map(entry => entry.text), ['four']);
    assert.deepEqual(slotValue(chronicle.noted).gap, { rev: 5, through: 'rc_note', minutes: null });
    assert.deepEqual(validateDays(chronicle), []);
    const back = noteCtx(chronicle.noted, { receiptId: 'rc_back', rev: 13 });
    noteCommand(back.ctx);
    assert.equal(back.asked[0].through, 'rc_note');
    assert.equal(slotValue(back.chronicle.noted).gap, undefined);
});

test('a host with no receipt ID: the note writes no `through` and reads by revision as before', () => {
    const { ctx, chronicle } = noteCtx(null, { receiptId: null });
    noteCommand(ctx);
    assert.equal('through' in slotValue(chronicle.noted), false);
});

test('the hook still asks by revision, with or without `through`', () => {
    const view = noted => ({ state: { meta: { rev: 5 }, domains: { chronicle: { noted: [noted] } } } });
    assert.equal(noteCommands(view({ rev: 4 })).length, 1);
    assert.equal(noteCommands(view({ rev: 5, through: 'rc_note' })).length, 0);
    assert.equal(noteCommands(view({ rev: 4, through: 'rc_note' })).length, 1);
});

test('the validator takes the older and newer `noted` and quest history shapes, and refuses broken ones', () => {
    const base = { minutes: null, from: null, settle: null };
    assert.deepEqual(validateDays({ noted: [{ rev: 3, ...base }] }), []);
    assert.deepEqual(validateDays({ noted: [{ rev: 3, through: 'rc_ab12', ...base, gap: { rev: 2, minutes: null } }] }), []);
    assert.deepEqual(validateDays({ noted: [{ rev: 3, ...base, gap: { rev: 2, through: 'rc_x', minutes: null } }] }), []);
    assert.equal(validateDays({ noted: [{ rev: 3, through: 7, ...base }] }).length, 1);
    assert.equal(validateDays({ noted: [{ rev: 3, through: '<b>', ...base }] }).length, 1);
    assert.equal(validateDays({ noted: [{ rev: 3, ...base, gap: { rev: 2, through: '', minutes: null } }] }).length, 1);
    assert.deepEqual(validateDays({ questLog: { 12: { thread: 'th_q', text: 'a' }, 's_ab.0': { thread: 'th_q', text: 'b', rev: 12 }, '12.0': { thread: 'th_q', text: 'c', rev: 12 } } }), []);
    assert.equal(validateDays({ questLog: { 's_ab.0': { thread: 'th_q', text: 'b' } } }).length, 1);
    assert.equal(validateDays({ questLog: { 12: { thread: 'th_q', text: 'a', rev: 12 } } }).length, 1);
    assert.equal(validateDays({ questLog: { 'x y': { thread: 'th_q', text: 'a', rev: 1 } } }).length, 1);
});

function outcomeCtx(questLog, extra) {
    const chronicle = { questLog };
    return { chronicle, ctx: { caller: 'story-director', draft: () => chronicle, fail(code) { throw new Error(code); }, ...extra } };
}

test('threadOutcome keys its line by reply, keeps its revision, and the note\'s line of the same revision does not overwrite it', () => {
    const { chronicle, ctx } = outcomeCtx({ 4: { thread: 'th_k', text: '+ quest K — kill' } }, { cause: 'story', carrier: { sid: 's_r1' }, rev: 12 });
    threadOutcome(ctx, { thread: 'th_k', text: 'K: done.' });
    assert.deepEqual(chronicle.questLog['s_r1.0'], { thread: 'th_k', text: 'K: done.', rev: 12 });
    assert.equal('12' in chronicle.questLog, false);
    // The note later keeps the capture's own line under its receipt revision (12): both stay, the line first.
    chronicle.questLog['12'] = { thread: 'th_k', text: '~ quest K | done' };
    chronicle.questLog['15'] = { thread: 'th_k', text: '~ quest K | later' };
    assert.deepEqual(questLogOf(chronicle, 'th_k').map(entry => [entry.rev, entry.text]), [[4, '+ quest K — kill'], [12, '~ quest K | done'], [12, 'K: done.'], [15, '~ quest K | later']]);
    assert.deepEqual(validateDays(chronicle), []);
});

test('threadOutcome outside a capture uses the reply and receipt ID; a host with no record ID gets `<rev>.<n>`', () => {
    const step = outcomeCtx({}, { cause: 'system', reply: { sid: 's_r2' }, receiptId: 'rc_k1', rev: 20 });
    threadOutcome(step.ctx, { thread: 'th_k', text: 'K: done.' });
    assert.deepEqual(Object.keys(step.chronicle.questLog), ['s_r2:rc_k1.0']);
    const bare = outcomeCtx({ 20: { thread: 'th_k', text: 'line' } }, { cause: 'story', rev: 20 });
    threadOutcome(bare.ctx, { thread: 'th_k', text: 'K: done.' });
    assert.deepEqual(Object.keys(bare.chronicle.questLog).sort(), ['20', '20.0']);
    assert.deepEqual(validateDays(bare.chronicle), []);
    assert.throws(() => threadOutcome(outcomeCtx({}, { caller: 'ui' }).ctx, { thread: 'th_k', text: 'x' }), /REFUSED/);
});
