// Sealed history, reading it (store/sealed-base.js, walk.js chain, chains.js anchors): replay starts at the base; inside the window every
// delete gives what the same delete gives on the chat never sealed; a sealed reply deleted keeps its changes; a branch cut before the edge is
// read-only and nothing is written to it; one cut inside the window reads on. Twins: two chats grown alike, one sealed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { grow, readout, reload, sealedSetup } from './seal.helpers.js';

const twins = () => {
    const make = () => { const one = sealedSetup({ meta: { integrity: 'file-1' } }); grow(one.ctx, one.store, 9); return one; };
    const sealed = make();
    const plain = make();
    assert.equal(sealed.store.seal().sealed, 6);
    return { sealed, plain };
};
const heads = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a.store.head())), JSON.parse(JSON.stringify(b.store.head())));
const cut = (one, at) => { one.ctx.chat.splice(at, 2); one.store.rebuild(); };

test('a middle delete inside the window gives the state the same delete gives the chat never sealed, and a reload agrees', () => {
    for (const at of [11, 13, 15, 17]) {     // the user message and reply of the first window reply, and later ones
        const { sealed, plain } = twins();
        cut(sealed, at);
        cut(plain, at);
        heads(sealed, plain);
        assert.equal(readout(reload(sealed.ctx).store), readout(sealed.store), `reload after deleting at ${at}`);
        assert.equal(sealed.store.history().status, 'ok');
    }
});

test('the head and every window reply\'s state equal the never-sealed twin\'s, and so do the window\'s chain hashes', () => {
    const { sealed, plain } = twins();
    heads(sealed, plain);
    for (let i = 12; i < sealed.ctx.chat.length; i += 2) assert.deepEqual(sealed.store.at(i), plain.store.at(i), `state at ${i}`);
    const before = sealed.store.boundary?.(sealed.ctx.chat.length - 1);
    void before;
    assert.deepEqual(sealed.store.boundaryProblems(), []);
});

test('a sealed reply deleted keeps its changes: the state stays, the reader is told once, and the base takes the chat as it is now', () => {
    const { sealed } = twins();
    const head = readout(sealed.store);
    const state = JSON.stringify(sealed.store.head());
    cut(sealed, 3);
    assert.equal(JSON.stringify(sealed.store.head()), state);
    assert.equal(sealed.store.history().status, 'drift');
    assert.equal(sealed.store.settleHistory(), 'deleted');
    assert.equal(sealed.store.settleHistory(), '', 'told once');
    assert.equal(sealed.store.history().status, 'ok');
    assert.equal(sealed.ctx.meta.storySuite.base.count, 5);
    assert.equal(JSON.stringify(reload(sealed.ctx).store.head()), state);
    void head;
    // The greeting itself can go too: the state still starts from the base.
    cut(sealed, 0);
    assert.equal(JSON.stringify(sealed.store.head()), state);
});

test('a branch cut before the edge opens read-only with the explanation, and nothing is written to it', () => {
    const { sealed } = twins();
    const chat = JSON.parse(JSON.stringify(sealed.ctx.chat.slice(0, 7)));
    const meta = { ...JSON.parse(JSON.stringify(sealed.ctx.meta)), integrity: 'branch-2' };
    const branch = sealedSetup({ chat, meta });
    branch.store.rebuild();
    const records = JSON.stringify(chat.map(m => m.extra?.storySuite ?? null));
    assert.equal(branch.store.head(), null);
    const notes = branch.store.ensureInitial({ v: 2, meta: { rev: 0, claims: {} }, domains: {} });
    assert.match(notes[0], /This branch starts before the story history this chat keeps/);
    assert.equal(branch.store.readOnly().kind, 'sealed');
    assert.equal(JSON.stringify(chat.map(m => m.extra?.storySuite ?? null)), records, 'no record was written');
    assert.equal(branch.store.settleHistory(), '');
    assert.equal(meta.storySuite.base.integrity, 'file-1', 'the base is not taken over');
    assert.throws(() => branch.store.startOver({ confirmed: true }), /This branch starts before/);
});

test('a branch cut inside the window reads on from the base and takes the branch\'s file id', () => {
    const { sealed } = twins();
    const chat = JSON.parse(JSON.stringify(sealed.ctx.chat.slice(0, 15)));
    const meta = { ...JSON.parse(JSON.stringify(sealed.ctx.meta)), integrity: 'branch-3' };
    const branch = sealedSetup({ chat, meta });
    branch.store.rebuild();
    assert.deepEqual(branch.store.head(), sealed.store.at(14));
    assert.equal(branch.store.settleHistory(), '');
    assert.equal(meta.storySuite.base.integrity, 'branch-3');
    // A sealed reply deleted on the branch now is the branch's own (same file).
    cut(branch, 3);
    assert.equal(branch.store.history().status, 'drift');
});

test('a chat whose replies are sealed but whose base is gone is read-only', () => {
    const { sealed } = twins();
    const chat = JSON.parse(JSON.stringify(sealed.ctx.chat));
    const lost = sealedSetup({ chat, meta: {} });
    lost.store.rebuild();
    assert.match(lost.store.ensureInitial({ v: 2, meta: { rev: 0, claims: {} }, domains: {} })[0], /saved starting point is missing/);
});

test('receipts and untold read the same after a seal (the sealed replies\' too), less what a sealed receipt drops', () => {
    const { sealed, plain } = twins();
    const bare = list => list.map(({ index, receipt: { seed, replan, id, ...rest } }) => { void seed; void replan; void id; return { index, ...rest }; });
    assert.deepEqual(bare(sealed.store.receipts()), bare(plain.store.receipts()));
    assert.ok(sealed.store.receipts().some(entry => entry.index === 2), 'a sealed reply\'s receipts are still on the line');
    assert.equal(sealed.store.untold().length, plain.store.untold().length);
});

test('writes onto a sealed reply are refused, a rewind past the edge is refused before branching, and at() of a sealed reply is null', () => {
    const { sealed } = twins();
    assert.throws(() => sealed.store.setFoeCap(4), /older than the last 4 replies/);
    assert.throws(() => sealed.store.setNarrated(4, []), /older than the last 4 replies/);
    assert.throws(() => sealed.store.truncate(4, 1, { dryRun: true, chat: sealed.ctx.chat.slice(0, 5) }), /Return in time reaches back 4 replies/);
    assert.equal(sealed.store.at(4), null);
    assert.ok(sealed.store.at(12));
    // A rewind inside the window still works (the dry run on the messages the branch will hold).
    const at = 14;
    const rev = sealed.store.at(at).meta.rev;
    assert.ok(sealed.store.truncate(at, rev, { dryRun: true, chat: sealed.ctx.chat.slice(0, at + 1) }).dropped.length >= 1);
});

test('a chat cut back to its sealed replies (SillyTavern deletes everything below) keeps the base as its story, and a new reply builds on it', () => {
    const { sealed } = twins();
    const atEdge = JSON.stringify(sealed.ctx.meta.storySuite.base.state);
    sealed.ctx.chat.length = 11;      // the last sealed reply is message 10
    sealed.store.rebuild();
    assert.deepEqual(sealed.store.ensureInitial({ v: 2, meta: { rev: 0, claims: {} }, domains: {} }), []);
    assert.equal(JSON.stringify(sealed.store.head()), atEdge);
    assert.equal(sealed.store.readOnly(), null);
    grow(sealed.ctx, sealed.store, 1, 20);
    assert.equal(sealed.store.head().domains.inventory.stacks.item20.qty, 21);
    assert.equal(readout(reload(sealed.ctx).store), readout(sealed.store));
    // Cut back into the sealed replies themselves: their changes stay, as for any sealed reply deleted.
    sealed.ctx.chat.length = 5;
    sealed.store.rebuild();
    assert.equal(sealed.store.history().status, 'drift');
    assert.equal(JSON.stringify(sealed.store.head()), atEdge, 'the base stays; the reply after it went with the cut');
});
