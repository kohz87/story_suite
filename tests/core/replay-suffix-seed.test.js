// LIVEPERF findings 3 and 4 (LPA): an edited Re-read and a middle delete froze the page for 2.5 s, most of it replaying the chat from
// its checkpoint again right after the rebuild had replayed it (store.before for the Re-read; the reconcile's base and a second whole
// head replay for its Problems). The head replay now keeps the state after each carrier it passed (store/prefix-memo.js seed), and the
// reconcile takes the head replay's Problems: only the replies from the change on are replayed. The states are a fresh store's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { guarded, harness } from './helpers/guarded.js';

const REPLIES = 12;
const id = i => `th_quest${String(i).padStart(3, '0')}`;

function tell(asked, { strict = false, options = {} } = {}) {
    const h = harness([guarded({ asked, strict })], options);
    for (let i = 1; i <= REPLIES; i++) {
        h.send(`u${i}`, `r${i}`);
        assert.equal(h.command('gt.quick', { id: id(i) }).ok, true);
    }
    return h;
}

// The same chat in a new store: what a replay from scratch gives.
function fresh(chat, { strict = false, options = {} } = {}) {
    const b = harness([guarded({ strict })], options);
    b.chat.splice(0, b.chat.length, ...structuredClone(chat));
    b.store.rebuild();
    return b;
}

test('an edited Re-read: after the rebuild, the state before the reply comes from the head replay, no guard asked again, and it is a fresh store\'s', () => {
    const asked = [];
    const h = tell(asked);
    const head = h.chat.length - 1;
    h.chat[head].mes = `${h.chat[head].mes} A gull cried.`;      // the reader's edit (ST tells it, the turn rebuilds)
    h.chat[head].swipes = [h.chat[head].mes];
    h.store.rebuild();
    asked.length = 0;
    const before = h.store.before(head);
    assert.equal(asked.length, 0, `nothing before the reply is replayed again (guards asked: ${asked.length})`);
    assert.deepEqual(before, fresh(h.chat).store.before(head));
});

test('an earlier message changed after the rebuild (no event): the kept states from it on are not used; the state is a fresh store\'s', () => {
    const asked = [];
    const h = tell(asked);
    const head = h.chat.length - 1;
    h.store.rebuild();
    h.chat[6].mes = 'r3, said otherwise';
    h.chat[6].swipes = [h.chat[6].mes];
    assert.deepEqual(h.store.before(head), fresh(h.chat).store.before(head));
});

test('a middle delete: the reconcile replays the replies from the change on only, and ends where a fresh store does', () => {
    const asked = [];
    const h = tell(asked);
    h.chat.splice(9, 2);                         // reply 5 and the reader's message before it
    h.store.rebuild();
    const at = 10;                               // reply 6, now right after reply 4
    const after = h.chat.filter((message, index) => index >= at && !message.is_user).length;
    asked.length = 0;
    h.store.reconcile(at, { rerun: () => ({ ok: false, code: 'NOT_ASKED', message: 'not asked in this test' }) });
    assert.ok(asked.length <= after, `only the ${after} replies from the change on are replayed (guards asked: ${asked.length})`);
    const other = fresh(h.chat);
    assert.deepEqual(h.store.head(), other.store.head());
    assert.deepEqual(h.store.problems(), other.store.problems());
});

const rerun = () => ({ ok: false, code: 'NOT_ASKED', message: 'not asked in this test' });

test('an earlier reply\'s text changed after the rebuild with no event: the reconcile does not take the head replay\'s Problems; it writes what a fresh store does', () => {
    // (strict: a guard also checks its reply's text, so the change brings a Problem; checkpoints every 3 replies carry the Problems before them)
    const options = { checkpointEvery: 3, checkpointBytes: 1 << 30 };
    const h = tell([], { strict: true, options });
    h.store.rebuild();
    h.chat[14].mes = 'r7, said otherwise';
    h.chat[14].swipes = [h.chat[14].mes];
    const before = JSON.stringify(h.chat);
    h.store.reconcile(16, { rerun });
    const other = fresh(JSON.parse(before), { strict: true, options });
    other.store.reconcile(16, { rerun });
    assert.equal(JSON.stringify(h.chat), JSON.stringify(other.chat), 'the reconcile wrote what a fresh store\'s does');
    h.store.rebuild();
    assert.deepEqual(h.store.problems(), other.store.problems());
    assert.deepEqual(h.store.head(), other.store.head());
});

test('over several checkpoints and a middle delete: the state before every reply and the replan point are a fresh store\'s', () => {
    const options = { checkpointEvery: 3, checkpointBytes: 1 << 30 };
    const h = tell([], { options });
    assert.ok(h.chat.filter(message => message.extra?.storySuite?.checkpoint).length >= 3, 'the chat has several checkpoints');
    h.chat.splice(13, 2);
    h.store.rebuild();
    const other = fresh(h.chat, { options });
    for (let i = 1; i < h.chat.length; i++) {
        if (h.chat[i].is_user) continue;
        assert.deepEqual(h.store.before(i), other.store.before(i), `the state before reply ${i}`);
        assert.equal(h.store.replansFrom(), other.store.replansFrom(), `the replan point after asking ${i}`);
    }
});
