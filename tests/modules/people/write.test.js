// The people domain of a new chat (no flag): present from the start, `people.write` stores only changed leaves; a wrong sid is STALE,
// a bad view INVALID (portraits as image bytes, a bad socialGraph), the receipt is not a reader edit, an equal hash needs no send.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../../testkit/index.js';
import { hashJson } from '../../../../../core/replay.js';
import { readRecord } from '../../../../../core/persist.js';
import { replyEdits } from '../../../../../ui/legacy/reply-cards.js';
import { isPeopleView, validatePeople } from '../../../src/v2/domains/people/validate.js';

async function peopleHost(t) {
    const host = await createHost();
    t.after(() => host.close());
    return host;
}
const view = (extra = {}) => ({ v: 1, order: ['npc_ann'], npcs: { npc_ann: { name: 'Ann', stage: 2 } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1, ...extra });
const sourceOf = host => { const s = host.store.sourceAt(host.store.headIndex()); return { sid: s.sid, swipeKey: s.swipeKey }; };
const send = (host, source, v) => host.sdk.command('people.write', { v: 1, source, view: v });
const opsOnHead = host => host.store.opsAt(host.store.headIndex());
// The first write starts the slice from people's initial value, so the stored slice is the view with the empty meters (`bonds`, P4) beside it.
const stored = v => ({ ...v, bonds: { npcs: {}, problems: [] } });

test('the first write stores the people, and the query hash matches the stored slice (a chat with no people holds no people slice)', async t => {
    const host = await peopleHost(t);
    await host.send('Go.', 'The road.');
    assert.equal(host.head().domains.people, undefined, 'an empty initial slice is not stored: a chat that never uses people stays byte-identical');
    assert.equal(host.sdk.query('people.hash'), null);
    assert.throws(() => host.sdk.query('people.mirrorOn'), /no module answers/, 'no flag query');
    const result = await send(host, sourceOf(host), view());
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
    assert.deepEqual(host.head().domains.people, stored(view()));
    assert.equal(host.sdk.query('people.hash'), hashJson(stored(view())));
    assert.equal(host.sdk.query('people.hash', { dossiers: true }), hashJson(view()), 'the dossier hash is the view\'s');
});

test('the next write stores only the changed leaves', async t => {
    const host = await peopleHost(t);
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    const before = opsOnHead(host).length;
    const next = view({ npcs: { npc_ann: { name: 'Ann', stage: 3 } }, turn: 2 });
    assert.equal((await send(host, sourceOf(host), next)).ok, true);
    const fresh = opsOnHead(host).slice(before).map(op => op.path).filter(path => path.startsWith('/domains/people')).sort();
    assert.deepEqual(fresh, ['/domains/people/npcs/npc_ann/stage', '/domains/people/turn']);
    assert.deepEqual(host.head().domains.people, stored(next));
});

test('a sid that is not the head is STALE, a bad view is INVALID, and neither stores anything', async t => {
    const host = await peopleHost(t);
    await host.send('Go.', 'The road.');
    const source = sourceOf(host);
    const stale = await send(host, { ...source, sid: `${source.sid}x` }, view());
    assert.equal(stale.code, 'STALE');
    const png = 'data:image/png;base64,AAAA';
    const bads = [view({ portraitAssets: { npc_ann: { dataUrl: png } } }), view({ portraitAssets: { npc_ann: { path: png, type: 'image/png', hash: 'h' } } }), view({ npcs: { npc_ann: { name: 'Ann', face: png } } }), view({ socialGraph: { edges: [{ aId: 'npc_ann', bId: 'bob' }] } }), null, {}, view({ v: 2 }), view({ order: ['npc_bo'] }), view({ npcs: { npc_ann: [] } }), view({ turn: 1.5 }), view({ socialGraph: { x: () => 1 } }), view({ candidates: 'no' })];
    for (const bad of bads) assert.equal((await send(host, source, bad)).code, 'INVALID', JSON.stringify(bad));
    assert.equal(host.head().domains.people, undefined);
    assert.equal(opsOnHead(host).some(op => String(op.path).startsWith('/domains/people')), false);
});

test('the write receipt is not a reader edit (it never shows on the reply card)', async t => {
    const host = await peopleHost(t);
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    const record = readRecord(host.ctx.chat[host.store.headIndex()]);
    const mine = record.receipts.filter(receipt => receipt.type === 'people.write');
    assert.equal(mine.length, 1);
    assert.notEqual(mine[0].data?.edit, true);
    assert.deepEqual(replyEdits(record), []);
});

test('an equal hash means the sender has nothing to send (the query is the comparison)', async t => {
    const host = await peopleHost(t);
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    assert.equal(hashJson(view()), host.sdk.query('people.hash', { dossiers: true }));
    assert.notEqual(hashJson(view({ turn: 2 })), host.sdk.query('people.hash', { dossiers: true }));
});

test('validate: sound views pass, odd ones say why', () => {
    assert.equal(isPeopleView(view()), true);
    assert.equal(isPeopleView({ v: 1, order: [], npcs: {} }), true);
    assert.match(validatePeople(view({ order: ['npc_ann', 'npc_ann'] })).join(' '), /order/);
    assert.match(validatePeople(view({ npcs: { npc_ann: [] } })).join(' '), /record/);
    assert.match(validatePeople(view({ turn: NaN })).join(' '), /whole number|JSON/);
    // Records are keyed by Delta's own ids (npc_ + a name slug, `_2` suffixes, other scripts); nothing unsafe as a JSON-pointer segment passes.
    for (const good of ['npc_myla', 'npc_tobin-ash', 'npc_myla_2', 'npc_import_zoë', 'npc_0', 'npc_李']) assert.equal(isPeopleView(view({ order: [good], npcs: { [good]: { id: good } } })), true, good);
    for (const bad of ['a', 'myla', 'npc_', 'npc_a/b', 'npc_a~b', 'npc_a b', 'npc_a.b', '/npc_a', '__proto__', 'constructor']) {
        const probe = view({ order: [bad], npcs: { [bad]: { id: bad } } });
        assert.equal(isPeopleView(probe), false, bad);
        assert.match(validatePeople(probe).join(' '), /NPC id/);
    }
    assert.match(validatePeople(view({ portraitAssets: { 'x/y': { path: 'p.png', type: 'image/png', hash: 'h' } } })).join(' '), /portrait/);
    // Portraits are file references only; a data URL (as a record, a path or any text) is image bytes.
    const ref = { path: '/user/files/p.png', type: 'image/png', hash: 'abc' };
    assert.equal(isPeopleView(view({ portraitAssets: { npc_ann: ref } })), true);
    for (const bad of ['p.png', { path: 'p.png' }, { dataUrl: 'data:image/png;base64,AAAA' }, { ...ref, dataUrl: 'x' }, { ...ref, path: 'data:image/png;base64,AAAA' }]) {
        assert.match(validatePeople(view({ portraitAssets: { npc_ann: bad } })).join(' '), /portrait|image bytes/, JSON.stringify(bad));
    }
    // socialGraph: safe keys, and the ids of its edges and open slots are people ids.
    assert.equal(isPeopleView(view({ socialGraph: { edges: [{ aId: 'npc_ann', bId: 'npc_bo', aToB: 'friend' }], unresolved: [{ ownerId: 'npc_ann' }] } })), true);
    assert.match(validatePeople(view({ socialGraph: { 'a/b': 1 } })).join(' '), /socialGraph/);
    assert.match(validatePeople(view({ socialGraph: { edges: [{ aId: 'npc_ann', bId: '../x' }] } })).join(' '), /socialGraph/);
    assert.equal(isPeopleView(view({ socialGraph: { edges: [{ a: 'Ann', b: 'Bob', aId: '', bId: null, aToB: 'friend' }], unresolved: [{ ownerId: '' }] } })), true, "an empty or null edge id is 'no id'");
    assert.match(validatePeople(view({ socialGraph: { unresolved: [{ ownerId: 'ann' }] } })).join(' '), /socialGraph/);
    assert.deepEqual(validatePeople('x'), ['The people domain is not an object.']);
});
