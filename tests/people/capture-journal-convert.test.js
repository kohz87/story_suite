// N7: the one-time move of a capture journal from the lineage key to the reply's sid (journal-convert.js). The fixture is a journal saved under the old keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertJournal } from '../../modules/people/runtime/runtime-narration-parts/journal-convert.js';
import { captureJournalEntry } from '../../modules/people/runtime/runtime-narration-parts/capture-journal.js';
import { useReplySids } from '../../modules/people/runtime/runtime-narration-parts/journal-keys.js';

const msg = (mes, is_user = false) => ({ is_user, mes });
// The keys the branch code saved for spanningChat() (literals: the old code may be deleted).
const OLD_KEYS = ['1nu486o.irgfgk', '1sau28t.vshmll', '1tejvgt.udvgmx', '9yhcyo.b28owk'];
test.afterEach(() => useReplySids(null));

function spanningChat() {
    const chat = [msg('hello'), msg('Orsen waves.'), msg('go', true), msg('Mira nods.')];
    const keys = OLD_KEYS;
    const state = { captureJournal: [
        { messageId: 1, key: keys[1], backgroundRule: 1, parsed: { npcs: [{ name: 'Orsen' }] }, fills: { npc_orsen: { a: 1 } } },
        { messageId: 3, key: keys[3], backgroundRule: 1, fills: {}, refreshes: { npc_mira: { b: 2 } } },
        { messageId: 3, key: 'gone-with-a-swiped-reply', backgroundRule: 1, fills: {} },
    ] };
    return { chat, state };
}

test('a chat that spans the switch: every entry that still matches a reply moves to its sid, the others are dropped and counted', () => {
    const { chat, state } = spanningChat();
    const sidAt = index => `sid-${index}`;
    const report = convertJournal(state, chat, sidAt);
    assert.deepEqual(report, { converted: 2, dropped: 1, waiting: 0 });
    assert.deepEqual(state.captureJournal.map(item => item.key), ['sid:sid-1', 'sid:sid-3']);
    assert.deepEqual(state.captureJournal[0].parsed, { npcs: [{ name: 'Orsen' }] }, 'the payload moves whole');
    assert.deepEqual(state.captureJournal[1].refreshes, { npc_mira: { b: 2 } });
    useReplySids(index => sidAt(index));
    assert.ok(captureJournalEntry(state, chat, 1) && captureJournalEntry(state, chat, 3), 'the hosted lookup finds them');
    assert.deepEqual(convertJournal(state, chat, sidAt), { converted: 0, dropped: 0, waiting: 0 }, 'a second run does nothing');
    assert.equal(state.captureJournal.length, 2);
});

test('while the host cannot say a sid the entries wait, and the move is not marked done', () => {
    const { chat, state } = spanningChat();
    const report = convertJournal(state, chat, () => null);
    assert.deepEqual(report, { converted: 0, dropped: 1, waiting: 2 });
    assert.equal(state.captureJournal.length, 2);
    assert.equal(state.captureJournalKeys, undefined);
    assert.equal(convertJournal(state, chat, i => `sid-${i}`).converted, 2);
});

test('an edited reply\'s old entry matches nothing and is dropped, not moved onto the new text', () => {
    const { chat, state } = spanningChat();
    chat[1].mes = 'Orsen waves, twice.';
    const report = convertJournal(state, chat, i => `sid-${i}`);
    assert.equal(report.converted, 0);
    assert.equal(report.dropped, 3);
});
