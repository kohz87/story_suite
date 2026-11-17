// N8 rolling catch-up (owner 17 Nov): each person waits N replies between Refreshes; after a reply at most K people go.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: { chat: [] }, saveSettingsCalls: 0 };
const { createCatchUpPart } = await import('../../modules/people/calls/runtime-catchup.js');
const { pickRolling } = await import('../../modules/people/calls/catchup-pick.js');
const { noteManualRefresh } = await import('../../modules/people/calls/catchup-history.js');
const { useReplySids } = await import('../../modules/people/runtime/runtime-narration-parts/journal-keys.js');
const { recordReadMark } = await import('../../modules/people/runtime/runtime-narration.js');

// A chat of replies with a journal. `every` = N, `people` = K. Each reply names who is in it; sid mode gives every reply its own ID (hosted).
function rig({ every = 4, people = 1, sids = false } = {}) {
    const state = { npcs: [], pendingBackfills: [], captureJournal: [] };
    const chat = [];
    globalThis.__npcMock.context = { chat };
    useReplySids(sids ? at => chat[at]?.sid ?? null : null);
    const deps = {
        readSettings: () => ({ narrationCaptureCatchUp: every, narrationCaptureCatchUpPeople: people }), getChatKey: () => 'chat', getChatState: () => state,
        isHostSwipeActive: () => false, isScanBusy: () => false, persist: () => {}, processPendingBackfills: async () => {}, refreshNpcFromChat: async () => true,
    };
    const part = createCatchUpPart({}, deps);
    let n = 0;
    const next = present => { const at = chat.length; chat.push({ name: 'Narrator', mes: `reply ${n += 1}`, is_user: false, sid: `s${n}` }); return part.noteCaptureCatchUp('chat', present, at); };
    return { state, chat, part, next, manual: id => noteManualRefresh(state, chat, id) };
}
const run = (r, present, count) => Array.from({ length: count }, () => r.next(present));

test('pick: nobody is due before they have waited N replies, then one person per reply, 3 of every 4 replies (N=4, K=1)', () => {
    const r = rig();
    assert.deepEqual(run(r, ['a', 'b', 'c', 'd', 'e'], 9), [[], [], [], ['a'], ['b'], ['c'], [], ['d'], ['e']]);
});

test('pick: N=5, K=1 allows 4 per 5 replies; K=2, N=4 allows 6 per 4 and 2 per reply', () => {
    const five = rig({ every: 5 });
    const taken = run(five, 'abcdefgh'.split(''), 14).map(list => list.length);
    for (let from = 0; from + 5 <= taken.length; from += 1) assert.ok(taken.slice(from, from + 5).reduce((a, b) => a + b, 0) <= 4, `window at ${from}`);
    assert.ok(taken.some(count => count === 1) && taken.every(count => count <= 1));
    const two = rig({ people: 2 });
    const counts = run(two, 'abcdefghij'.split(''), 14).map(list => list.length);
    assert.ok(counts.every(count => count <= 2));
    for (let from = 0; from + 4 <= counts.length; from += 1) assert.ok(counts.slice(from, from + 4).reduce((a, b) => a + b, 0) <= 6);
    assert.ok(counts.includes(2));
});

test('pick: a person not seen in the last N replies is never taken, and one seen only in the current reply can be', () => {
    const r = rig({ every: 2 });
    run(r, ['gone'], 2);   // seen early, then away
    const later = run(r, ['a'], 4);
    assert.ok(!later.flat().includes('gone'));
    assert.ok(later.flat().includes('a'));
});

test('pick: overdue (3N replies, 12 at the default) jumps the queue, longest-waiting first, ahead of the most seen', () => {
    const quiet = Array.from({ length: 14 }, () => ({ seen: ['busy'], took: [], manual: [] }));
    quiet[0].seen = ['busy', 'rare'];
    quiet[9].took = ['busy'];   // busy: last Refreshed 5 replies ago (eligible, not overdue); `rare` never (waited 15)
    const history = [...quiet, { seen: ['busy', 'rare'], took: [], manual: [] }];
    assert.deepEqual(pickRolling(history, 4, 1), ['rare'], 'overdue first although busy was seen 4 times');
    assert.deepEqual(pickRolling(history, 4, 2), ['rare', 'busy']);
    const two = [...Array.from({ length: 14 }, () => ({ seen: [], took: [], manual: [] })), { seen: ['x', 'y'], took: [], manual: [] }];
    two[0].seen = ['x', 'y'];
    two[1].manual = ['y'];   // both overdue; x has waited longer (never) than y (13)
    assert.deepEqual(pickRolling(two, 4, 1), ['x'], 'longest-waiting first');
});

test('pick: otherwise the most seen in the last N replies; ties go to the one refreshed longest ago, then by id', () => {
    const base = Array.from({ length: 6 }, () => ({ seen: [], took: [], manual: [] }));
    const h = base.map(item => ({ ...item }));
    h[2].took = ['b']; h[1].took = ['c'];   // b 4 ago... c 5 ago (they are the only ones refreshed)
    h[3].seen = ['a', 'b', 'c', 'm']; h[4].seen = ['a', 'b', 'c', 'm']; h[5].seen = ['a', 'b', 'c', 'm', 'z'];
    h[2].seen = ['m'];
    h[0].seen = ['a', 'b', 'c', 'm'];   // present from the first reply, never Refreshed (m, a: waited 6)
    // seen in the last 4 replies (idx 2-5): m 4, a 3, b 3, c 3, z 1. m has waited 6 (never), a 6, b 3 (not eligible), c 4 (eligible).
    assert.deepEqual(pickRolling(h, 4, 1), ['m'], 'most seen');
    const tie = h.map(item => ({ ...item, seen: [...item.seen].filter(id => id !== 'm') }));
    // a 3 (waited 6), c 3 (waited 4): the same count, a has waited longest.
    assert.deepEqual(pickRolling(tie, 4, 1), ['a']);
    assert.deepEqual(pickRolling(tie, 4, 2), ['a', 'c'], 'b is not due yet');
});

test('pick: the people left over keep their place and lead next time', () => {
    const r = rig({ every: 4, people: 1 });
    const first = run(r, ['a', 'b', 'c'], 4);   // reply 4: a goes; b, c wait
    assert.deepEqual(first[3], ['a']);
    assert.deepEqual(r.next(['a', 'b', 'c']), ['b'], 'the next reply: b (leads over c by id, and nobody was pushed back)');
    assert.deepEqual(r.next(['a', 'b', 'c']), ['c'], 'c was skipped twice and still goes next');
});

test('manual Refresh: A refreshed at reply 1 is next eligible at reply 5 (N=4), others can go meanwhile', () => {
    const r = rig();
    run(r, ['d', 'e', 'a'], 1);
    r.manual('a');   // after reply 1
    const rest = run(r, ['a', 'd', 'e'], 8);   // replies 2..9
    const flat = rest.flat();
    assert.ok(rest[0].length === 0 && rest[1].length === 0, 'replies 2 and 3: still inside the first wait');
    assert.ok(!rest.slice(0, 3).flat().includes('a'), 'A is not taken before reply 5');
    assert.ok(rest.findIndex(list => list.includes('a')) + 2 >= 5, 'and not before reply 5');
    assert.ok(flat.includes('d') && flat.includes('e'));
});

test('replay == live: a swipe, a swipe back, an edit, a middle delete and a reload read the same marks (hosted sids)', () => {
    const r = rig({ sids: true });
    run(r, ['a', 'b', 'c'], 5);   // the 4th reply took a, the 5th took b
    const last = r.chat.length - 1;
    const asked = present => r.part.noteCaptureCatchUp('chat', present, r.chat.length - 1);
    const before = asked(['a', 'b', 'c']);
    // swipe: new text, same message id: the new swipe is a new reply to the journal and decides from the chat before it
    const original = r.chat[last].mes;
    r.chat[last].mes = 'a different swipe';
    assert.deepEqual(asked(['a', 'b', 'c']), before, 'a swipe decides the same way (the picks of the replies before it are unchanged)');
    r.chat[last].mes = original;   // swipe back: finds its own entry again
    assert.deepEqual(r.state.captureJournal.find(item => item.key === `sid:s${last + 1}`)?.roll.took, before, 'the reply\'s own entry holds what it took');
    assert.deepEqual(asked(['a', 'b', 'c']), before, 'swipe back repeats it');
    // reload: the journal makes a round trip through JSON and a new part decides the same
    const copy = JSON.parse(JSON.stringify(r.state));
    Object.assign(r.state, copy);
    assert.deepEqual(asked(['a', 'b', 'c']), before, 'reload');
    // edited Re-read: the reply's text changes (grown, shrunk): the marks of the reply stay
    for (const text of ['grown '.repeat(40), 'x']) {
        r.chat[last].mes = text;
        const entry = recordReadMark(r.state, r.chat, last);
        assert.ok(entry.roll?.took, 'the edited reply keeps its marks');
        r.chat[last].mes = original;
        recordReadMark(r.state, r.chat, last);
    }
    // a middle delete: the replies after it still count in order
    r.chat.splice(1, 1);
    const afterDelete = asked(['a', 'b', 'c']);
    assert.ok(afterDelete.length <= 1 && afterDelete.every(id => ['a', 'b', 'c'].includes(id)));
    assert.deepEqual(asked(['a', 'b', 'c']), afterDelete, 'asking twice gives the same answer');
});

test('rewind: replies cut from the end are forgotten, so the picks after them are the picks as if they never came', () => {
    const r = rig({ sids: true });
    const first = run(r, ['a', 'b', 'c'], 7);
    const cut = r.chat.splice(5);   // back to 5 replies
    assert.equal(cut.length, 2);
    const again = r.next(['a', 'b', 'c']);
    assert.deepEqual(again, first[5], 'the new 6th reply decides what the old 6th did');
});

test('a newcomer in a long chat waits N replies from their first reply, not overdue and not ahead of the others (N=4, K=1)', () => {
    const history = Array.from({ length: 30 }, () => ({ seen: ['b'], took: [], manual: [] }));
    history[20].took = ['b'];   // b: Refreshed 10 replies ago, due and not overdue
    history.push({ seen: ['z', 'b'], took: [], manual: [] });
    assert.deepEqual(pickRolling(history, 4, 1), ['b'], 'z has been seen for one reply');
    const later = [...history, ...Array.from({ length: 3 }, () => ({ seen: ['z'], took: [], manual: [] }))];
    assert.ok(pickRolling(later, 4, 3).includes('z'), 'after N replies seen, z is due like anyone');
    assert.ok(!pickRolling(history.slice(0, 31).concat({ seen: ['z'], took: [], manual: [] }), 4, 3).includes('z'), 'two replies seen: not yet');
});
