// Perf PB8 (docs/dev/edit-prose-only.md): a prose-only edit of a reply (its change block and stray change lines as they
// were, every block of it applied after the rebuild) skips the reconcile; every other edit still plans the guarded steps
// again. The work is counted (store.reconcile calls), not only the state: the state is the same either way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { readRecord } from '../../core/persist.js';
import { Q1, guarded } from './helpers/guarded.js';

const plain = value => JSON.parse(JSON.stringify(value ?? null));
// What replay reads from each record (the swipe mark, which follows the text's opening, is stamped again by the rebuild as on main).
const stored = host => host.ctx.chat.map(message => {
    const record = readRecord(message);
    return record ? plain({ ops: record.ops, spans: record.spans, receipts: record.receipts, checkpoint: record.checkpoint ?? null, source: record.source }) : null;
});

// A chat whose replies each hold guarded blocks: a clock line, a guarded story line (`! quick`) and a guarded system
// step that is planned again (`gt.attempt`, replan). → { host, replies, reconciles() }.
async function chat(t, options = {}) {
    const host = await createHost({ modules: [guarded(options)], core: false });
    t.after(() => host.close());
    t.mock.method(console, 'warn', () => {});
    const replies = [];
    for (let k = 0; k < 5; k++) {
        await host.send(`Go ${k}.`, `Story ${k} goes on.\n\n<Changes>\n! tick ${30 * k}\n! quick th_quickst${k}\n</Changes>`);
        replies.push(host.ctx.chat.length - 1);
        await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
        // (a reader's quick quest on the reply: its guard reads the reply text when the module is `strict`)
        await host.bus.command('gt.quick', { id: `th_uiquick${k}` }, { cause: 'ui' });
    }
    await host.store.flush();
    let calls = 0;
    const reconcile = host.store.reconcile;
    host.store.reconcile = (...args) => { calls += 1; return reconcile.apply(host.store, args); };
    return { host, replies, reconciles: () => calls };
}

const heads = host => { const seen = []; host.sdk.on('head', () => seen.push(true)); return seen; };
const prose = (host, at, from, to) => host.ctx.chat[at].mes.replace(from, to);

test('a prose-only edit of an early reply skips the reconcile; state, Problems and records stay as they were, one head is published', async t => {
    const { host, replies, reconciles } = await chat(t);
    const before = { head: plain(host.store.head()), problems: plain(host.store.problems()), records: stored(host) };
    assert.ok(Number.isInteger(host.store.replansFrom()), 'the chat holds steps that are planned again');
    const seen = heads(host);
    await host.st.editMessage(replies[0], prose(host, replies[0], 'Story 0 goes on.', 'Story 0 goes on, told again in other words.'));
    assert.equal(reconciles(), 0, 'nothing is planned again');
    assert.deepEqual(plain(host.store.head()), before.head);
    assert.deepEqual(plain(host.store.problems()), before.problems);
    assert.equal(seen.length, 1, 'the edit is published once');
    // (the records are not rewritten: the edit's stale stamps wait for the next swipe, delete or Re-read)
    assert.deepEqual(stored(host), before.records);
});

test('the full path still runs for a block edit, a user message edit, a stray change line and no index', async t => {
    const { host, replies, reconciles } = await chat(t);
    let calls = reconciles();
    const ran = async (label, fn) => { await fn(); assert.equal(reconciles(), calls + 1, `${label}: the reconcile runs`); calls = reconciles(); };
    await ran('a new block in the reply', () => host.st.editMessage(replies[1], `${host.ctx.chat[replies[1]].mes}\n<Changes>\n! tick 5\n</Changes>`));
    await ran('the hidden block changed', () => host.st.editMessage(replies[2], host.ctx.chat[replies[2]].mes.replace('! tick 60', '! tick 61')));
    await ran('a user message', () => host.st.editMessage(replies[2] - 1, 'Go somewhere else.'));
    await ran('a stray change line in the story', () => host.st.editMessage(replies[3], prose(host, replies[3], 'Story 3 goes on.', 'Story 3 goes on.\n! tick 7\n')));
    await ran('no index', async () => {
        host.ctx.chat[replies[4]].mes = prose(host, replies[4], 'Story 4', 'Story four');
        await host.ctx.eventSource.emit(host.ctx.eventTypes.MESSAGE_EDITED);
    });
});

test('the index may come as text (SillyTavern passes a number; a string is read as one)', async t => {
    const { host, replies, reconciles } = await chat(t);
    const at = replies[1];
    host.ctx.chat[at].mes = prose(host, at, 'Story 1 goes on.', 'Story 1, retold.');
    await host.ctx.eventSource.emit(host.ctx.eventTypes.MESSAGE_EDITED, String(at));
    assert.equal(reconciles(), 0);
});

test('a guard that reads the reply text turns a block of the edited reply off: the full path runs, as before', async t => {
    const { host, replies, reconciles } = await chat(t, { strict: true });
    await host.st.editMessage(replies[0], prose(host, replies[0], 'Story 0 goes on.', 'Story 0, changed.'));
    assert.ok(host.store.problems().some(problem => problem.index === replies[0]), 'the strict guard turned the quick line off');
    assert.equal(reconciles(), 1);
});

test('a second prose edit of the same reply skips too (the text is remembered after each head)', async t => {
    const { host, replies, reconciles } = await chat(t);
    await host.st.editMessage(replies[2], prose(host, replies[2], 'Story 2 goes on.', 'Story 2, once.'));
    await host.st.editMessage(replies[2], prose(host, replies[2], 'Story 2, once.', 'Story 2, twice.'));
    assert.equal(reconciles(), 0);
    // A later swipe plans the stale steps again, and the state is still what it was.
    const head = plain(host.store.head());
    await host.swipe('Story 4 again.\n\n<Changes>\n! tick 120\n! quick th_quickst9\n</Changes>');
    assert.equal(reconciles(), 1);
    assert.equal(host.store.head().domains.gt.minutes, head.domains.gt.minutes);
});
