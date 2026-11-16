// The Director's problems after an edited Re-read (PROBLEMSKEY): each is keyed by its reply's record ID (`<sid>.<n>`,
// src/v2/reply-keys.js), so a later reply's stored `add` never lands on one the edited reply now writes, and the list reads in
// reply order. Compared with the story told the edited way: the stored problems and the reader's Problems list. An older
// state's `<rev>.<n>` keys still read in order; a swipe, a middle delete, a rewind and a reload give what live gave.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { addProblem, problemList, validateDirector } from '../../../../modules/time/tracker/domain.js';
import { withD1 } from '../../../helpers/director/d1.js';

const ERSVEIL = readFileSync(new URL('../../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const bad = (tag, n) => Array.from({ length: n }, (_, i) => `~ quest ${tag}${i} | step:`);

async function told(replies) {
    let host = null;
    const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [director] });
    for (const [i, lines] of replies.entries()) await host.send(`On ${i}.`, said(`R${i}.`, lines));
    return host;
}

const stored = host => host.head().domains.director.problems ?? {};
// The stored problems in their order, as the story tells them (a key and a rev name a reply and a receipt, which differ by telling).
const kept = host => problemList(host.head().domains.director).map(problem => `${problem.turn}:${problem.kind}:${problem.key}`);
// The reader's Problems list.
const seen = host => host.sdk.query('director.problems', {}).map(problem => `${problem.kind}:${problem.text}`);
const sidOf = (host, index) => host.ctx.chat[index].extra.storySuite.sid ?? null;
const replyAt = (host, tag) => host.ctx.chat.findIndex(message => !message.is_user && String(message.mes).startsWith(`${tag}.`));

function sameAsTold(host, fresh, where) {
    assert.deepEqual(kept(host), kept(fresh), `${where}: the stored problems`);
    assert.deepEqual(seen(host), seen(fresh), `${where}: the reader's Problems list`);
    assert.deepEqual(validateDirector(host.head().domains.director), [], `${where}: valid`);
}

function rebuiltSame(host, where) {
    const live = structuredClone(stored(host));
    host.store.rebuild();
    assert.deepEqual(stored(host), live, `${where}: a reload gives what live gave`);
}

const story = n => [['+ quest Q — go | giver: A'], bad('a', n), bad('b', 2), bad('c', 2)];

for (const grown of [4, 20]) {
    test(`an edited reply Re-read with ${grown} bad lines instead of 1: no later problem lands on its, the list reads as told that way`, async t => {
        t.mock.method(console, 'warn', () => {});
        const host = await told(story(1));
        const at = replyAt(host, 'R1');
        await host.st.editMessage(at, said('R1.', bad('a', grown)));
        assert.equal((await host.sdk.reread(at)).ok, true);
        const fresh = await told(story(grown));
        t.after(() => { host.close(); fresh.close(); });

        assert.equal(Object.keys(stored(host)).length, Object.keys(stored(fresh)).length, 'no problem lost');
        sameAsTold(host, fresh, 'after the Re-read');
        // Each reply's problems are under its own record ID, counted from 0.
        const own = Object.keys(stored(host)).filter(key => key.startsWith(`${sidOf(host, at)}.`)).sort((x, y) => Number(x.split('.')[1]) - Number(y.split('.')[1]));
        assert.deepEqual(own, Array.from({ length: grown }, (_, n) => `${sidOf(host, at)}.${n}`));
        rebuiltSame(host, 'after the Re-read');

        // One more reply: still the same as told.
        await host.send('More.', said('R4.', bad('d', 1)));
        await fresh.send('More.', said('R4.', bad('d', 1)));
        sameAsTold(host, fresh, 'one more reply');
    });
}

test('the same count of lines (1 → 1) is unchanged by a Re-read', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await told(story(1));
    const before = structuredClone(stored(host));
    const at = replyAt(host, 'R1');
    await host.st.editMessage(at, said('R1.', bad('a', 1)));
    assert.equal((await host.sdk.reread(at)).ok, true);
    t.after(() => host.close());
    assert.deepEqual(stored(host), before);
});

test('an older state\'s <rev>.<n> problems read in order, and a new problem joins after them', () => {
    const director = { turn: { n: 3 }, problems: { '12.0': { rev: 12, turn: 2, kind: 'x', text: 'b' }, '9.1': { rev: 9, turn: 1, kind: 'x', text: 'a1' }, '9.0': { rev: 9, turn: 1, kind: 'x', text: 'a0' } } };
    assert.deepEqual(problemList(director).map(problem => problem.text), ['a0', 'a1', 'b']);
    const key = addProblem(director, { cause: 'story', rev: 15, carrier: { sid: 'sw_new' } }, { kind: 'x', text: 'c' });
    assert.equal(key, 'sw_new.0');
    assert.deepEqual(problemList(director).map(problem => problem.text), ['a0', 'a1', 'b', 'c']);
    assert.deepEqual(validateDirector({ ...director, time: { minutes: null }, threads: {}, keys: {}, turn: { n: 3, now: null } }), []);
    // An older list (an array) is keyed once, as before.
    const legacy = { problems: [{ rev: 4, kind: 'x', text: 'old' }] };
    addProblem(legacy, { cause: 'story', rev: 6, carrier: { sid: 'sw_new' } }, { kind: 'x', text: 'new' });
    assert.deepEqual(Object.keys(legacy.problems), ['4.0', 'sw_new.0']);
    assert.deepEqual(problemList(legacy).map(problem => problem.text), ['old', 'new']);
});

test('past the room the oldest problems go, in the list\'s order, whatever their keys', () => {
    const director = { turn: { n: 1 }, problems: {} };
    for (let i = 0; i < 100; i += 1) addProblem(director, { cause: 'story', rev: 200 + i, carrier: { sid: 'sw_late' } }, { kind: 'x', text: `late${i}` });
    // An older key with a lower turn is the oldest, though its rev is the highest.
    director.problems['999.0'] = { rev: 999, turn: 0, kind: 'x', text: 'oldest' };
    addProblem(director, { cause: 'story', rev: 400, carrier: { sid: 'sw_late' } }, { kind: 'x', text: 'late100' });
    const list = problemList(director).map(problem => problem.text);
    assert.equal(list.length, 100);
    assert.ok(!list.includes('oldest') && !list.includes('late0'));
    assert.equal(list.at(-1), 'late100');
});

test('a swipe, a middle delete, a rewind and a reload give what the story told that way gives', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await told(story(2));
    t.after(() => host.close());
    await host.swipe(said('R3 again.', bad('s', 3)));
    const swiped = await told([...story(2).slice(0, 3), bad('s', 3)]);
    t.after(() => swiped.close());
    sameAsTold(host, swiped, 'after a swipe');
    rebuiltSame(host, 'after a swipe');

    // A middle delete: the exchange of R1 goes.
    const at = replyAt(host, 'R1');
    await host.st.deleteMessage(at);
    await host.st.deleteMessage(at - 1);
    const deleted = await told([story(2)[0], story(2)[2], bad('s', 3)]);
    t.after(() => deleted.close());
    assert.deepEqual(seen(host), seen(deleted), 'after a middle delete: the reader\'s Problems list');
    assert.deepEqual(problemList(host.head().domains.director).map(problem => `${problem.kind}:${problem.key}`),
        problemList(deleted.head().domains.director).map(problem => `${problem.kind}:${problem.key}`), 'after a middle delete: the stored problems');
    rebuiltSame(host, 'after a middle delete');
    await host.send('More.', said('R4.', bad('d', 1)));
    assert.equal(kept(host).at(-1).split(':').slice(1).join(':'), 'unknown-key:d0', 'a new reply\'s problem comes last');
    rebuiltSame(host, 'a reply after the delete');

    // A rewind to before the last reply's receipts: its problems go.
    const last = replyAt(host, 'R4');
    const first = host.sdk.receipts().find(entry => entry.index === last);
    const done = await host.sdk.rewind({ index: last, beforeRev: first.receipt.rev });
    assert.equal(done.ok, true);
    assert.ok(!kept(host).some(line => line.endsWith(':d0')), 'the rewound reply\'s problem is gone');
    assert.deepEqual(seen(host), seen(deleted), 'after the rewind: as before the reply');
    rebuiltSame(host, 'after the rewind');
});

test('a step\'s problem kept on a reply (calendar names) is not overwritten when that reply is Re-read with more lines', async t => {
    t.mock.method(console, 'warn', () => {});
    const tell = async second => {
        let host = null;
        const director = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
        host = await createHost({ modules: [director] });
        assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
        await host.send('Hi.', said('It is Goldwane 14.', ['~ time Goldwane 15, 611, 08:00 am', '+ quest Q — go | giver: A']));
        await host.send('Who?', said('R1. The ditch boy from Tuesday waved.', second));
        await host.send('On.', said('R2.', bad('b', 1)));
        return host;
    };
    const host = await tell(bad('a', 1));
    t.after(() => host.close());
    assert.equal(Object.values(stored(host)).filter(problem => problem.kind === 'calendar-names').length, 1);
    const at = replyAt(host, 'R1');
    await host.st.editMessage(at, said('R1. The ditch boy from Tuesday waved.', bad('a', 4)));
    assert.equal((await host.sdk.reread(at)).ok, true);
    const fresh = await tell(bad('a', 4));
    t.after(() => fresh.close());
    const kinds = h => problemList(h.head().domains.director).map(problem => `${problem.kind}:${problem.key}`).sort();
    assert.deepEqual(kinds(host), kinds(fresh), 'the same problems as told that way, none lost');
    rebuiltSame(host, 'after the Re-read');
});
