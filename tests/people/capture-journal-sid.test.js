// N7: a hosted reply's capture journal entry is found by the reply's own sid and the fingerprint of its text; not hosted by the lineage key as before.
// Each test names the rule it guards; reverting that rule in capture-journal.js / journal-keys.js turns it red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureJournalEntry, recordAcceptedCapture, recordAcceptedFill, recordReadMark } from '../../modules/people/runtime/runtime-narration-parts/capture-journal.js';
import { useReplySids } from '../../modules/people/runtime/runtime-narration-parts/journal-keys.js';
import { frozenLineageKeys } from '../../modules/people/runtime/runtime-narration-parts/journal-lineage.js';

const msg = (mes, extra = {}) => ({ is_user: false, mes, ...extra });
const sids = new Map();
const hosted = chat => useReplySids(index => sids.get(chat[index]) ?? null);
test.afterEach(() => { useReplySids(null); sids.clear(); });

test('the frozen lineage key never changes (these are the keys the branch code made for this chat; old saved keys must still convert)', () => {
    const chat = [msg('a'), { is_user: true, mes: 'b' }, msg('c <!-- x -->')];
    assert.deepEqual(frozenLineageKeys(chat), ['1te10c6.hvto0i', 'tgxtng.1thhrkw', '1agva4.1palao']);
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

test('not hosted: the lineage key and the message index, as before', () => {
    const chat = [msg('a'), msg('b')];
    const state = {};
    recordAcceptedCapture(state, chat, 1, { parsed: { npcs: [] } });
    assert.equal(state.captureJournal[0].key, frozenLineageKeys(chat)[1]);
    assert.equal('fp' in state.captureJournal[0], false);
    assert.ok(captureJournalEntry(state, chat, 1));
    assert.equal(captureJournalEntry(state, [msg('a'), msg('c')], 1), null);
});
