// N7: a hosted reply's capture journal entry is found by the reply's own sid and the fingerprint of its text; without a host there is no journal.
// Each test names the rule it guards; reverting that rule in capture-journal.js / journal-keys.js turns it red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureJournalEntry, recordAcceptedCapture, recordAcceptedFill, recordReadMark } from '../../modules/people/runtime/runtime-narration-parts/capture-journal.js';
import { useReplySids } from '../../modules/people/runtime/runtime-narration-parts/journal-keys.js';

const msg = (mes, extra = {}) => ({ is_user: false, mes, ...extra });
const sids = new Map();
const hosted = chat => useReplySids(index => sids.get(chat[index]) ?? null);
test.afterEach(() => { useReplySids(null); sids.clear(); });

test('the fingerprint strings are the ones the journal always stored (a saved entry is still found after the lineage copy went)', () => {
    const reply = msg('c <!-- x -->'); const chat = [reply]; sids.set(reply, 'sid-0'); hosted(chat);
    const state = {};
    recordReadMark(state, chat, 0);
    assert.deepEqual(state.captureJournal.map(item => [item.key, item.fp]), [['sid:sid-0', '1l6wjnu.ifqk1q']]);
});

test('hosted: a swipe finds no entry, a swipe back finds the first one again', () => {
    const first = msg('one'), second = msg('two');
    const chat = [msg('start'), first]; sids.set(first, 'sid-1'); sids.set(second, 'sid-2'); sids.set(chat[0], 'sid-0'); hosted(chat);
    const state = {};
    recordAcceptedCapture(state, chat, 1, { parsed: { npcs: [] } });
    assert.ok(captureJournalEntry(state, chat, 1));
    chat[1] = second;
    assert.equal(captureJournalEntry(state, chat, 1), null, 'another swipe is another reply');
    chat[1] = first;
    assert.ok(captureJournalEntry(state, chat, 1));
});

test('hosted: a middle delete moves the reply\'s index and its entry is still found', () => {
    const a = msg('a'), b = msg('b'), c = msg('c');
    const chat = [a, b, c]; for (const [i, m] of chat.entries()) sids.set(m, `sid-${i}`); hosted(chat);
    const state = {};
    recordAcceptedCapture(state, chat, 2, { parsed: { npcs: [] } });
    chat.splice(1, 1);
    assert.ok(captureJournalEntry(state, chat, 1), 'the entry of the reply now at index 1');
});

test('hosted: an edited reply keeps its sid and finds no entry; the stale one is replaced, not kept beside it', () => {
    const reply = msg('before'); const chat = [reply]; sids.set(reply, 'sid-0'); hosted(chat);
    const state = {};
    recordAcceptedCapture(state, chat, 0, { parsed: { npcs: [] } });
    reply.mes = 'after, longer';
    assert.equal(captureJournalEntry(state, chat, 0), null);
    recordReadMark(state, chat, 0);
    assert.equal(state.captureJournal.length, 1);
    assert.ok(captureJournalEntry(state, chat, 0));
});

test('hosted: a read mark is made for a reply with no scan, and a fill is kept in it', () => {
    const reply = msg('quiet'); const chat = [reply]; sids.set(reply, 'sid-0'); hosted(chat);
    const state = {};
    assert.equal(captureJournalEntry(state, chat, 0), null);
    recordAcceptedFill(state, chat, 0, 'npc_a', { x: 1 }, 'refreshes');   // no entry: nothing kept (why the mark is made first)
    assert.equal(state.captureJournal, undefined);
    const entry = recordReadMark(state, chat, 0);
    recordAcceptedFill(state, chat, 0, 'npc_a', { x: 1 }, 'refreshes');
    assert.deepEqual(entry.refreshes, { npc_a: { x: 1 } });
    assert.equal(recordReadMark(state, chat, 0), entry, 'asking again finds the same entry');
});

test('not hosted: no reply ID, so nothing is recorded or found; a saved lineage-keyed entry is ignored, never matched', () => {
    const chat = [msg('a'), msg('b')];
    const state = { captureJournal: [{ messageId: 1, key: '1te10c6.hvto0i', backgroundRule: 1, fills: {} }] };
    recordAcceptedCapture(state, chat, 1, { parsed: { npcs: [] } });
    assert.equal(recordReadMark(state, chat, 1), null);
    assert.equal(captureJournalEntry(state, chat, 1), null);
    assert.equal(state.captureJournal.length, 1, 'the old entry is left as it was');
    sids.set(chat[1], 'sid-1'); hosted(chat);
    assert.equal(captureJournalEntry(state, chat, 1), null, 'hosted, an entry under another key is never this reply\'s');
});
