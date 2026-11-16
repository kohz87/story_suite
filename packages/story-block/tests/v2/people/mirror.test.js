// The people part with its flag on: the first mirror stores one `add /domains/people`, the next only changed leaves; a wrong sid is STALE,
// a bad view INVALID, the receipt is not a reader edit, an equal hash needs no send. Flag-off proofs are in flag-off.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { FLAGS } from '../../../src/v2/flags.js';
import { hashJson } from '../../../src/v2/replay.js';
import { readRecord } from '../../../src/v2/persist.js';
import { replyEdits } from '../../../src/v2/reply-cards.js';
import { isPeopleView, validatePeople } from '../../../src/v2/domains/people/validate.js';

// The wired host; `withPart: false` builds one with the part left out (the core's test-only option).
async function peopleHost(t, { on = false, withPart = true } = {}) {
    const host = await createHost({ people: withPart, settings: on ? { flags: { [FLAGS.peopleInStore]: true } } : {} });
    t.after(() => host.close());
    return host;
}
const view = (extra = {}) => ({ v: 1, order: ['npc_ann'], npcs: { npc_ann: { name: 'Ann', stage: 2 } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1, ...extra });
const sourceOf = host => { const s = host.store.sourceAt(host.store.headIndex()); return { sid: s.sid, swipeKey: s.swipeKey }; };
const send = (host, source, v) => host.sdk.command('people.mirror', { v: 1, source, view: v });
const opsOnHead = host => host.store.opsAt(host.store.headIndex());

test('on: the first mirror is one add of /domains/people, and the query hash matches the stored slice', async t => {
    const host = await peopleHost(t, { on: true });
    await host.send('Go.', 'The road.');
    assert.equal(host.sdk.query('people.mirrorOn'), true);
    assert.equal(host.sdk.query('people.hash'), null);
    const result = await send(host, sourceOf(host), view());
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
    assert.deepEqual(host.head().domains.people, view());
    assert.equal(host.sdk.query('people.hash'), hashJson(view()));
    const adds = opsOnHead(host).filter(op => op.path === '/domains/people');
    assert.equal(adds.length, 1);
    assert.equal(adds[0].op, 'add');
});

test('on: the next mirror stores only the changed leaves', async t => {
    const host = await peopleHost(t, { on: true });
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    const before = opsOnHead(host).length;
    const next = view({ npcs: { npc_ann: { name: 'Ann', stage: 3 } }, turn: 2 });
    assert.equal((await send(host, sourceOf(host), next)).ok, true);
    const fresh = opsOnHead(host).slice(before).map(op => op.path).filter(path => path.startsWith('/domains/people')).sort();
    assert.deepEqual(fresh, ['/domains/people/npcs/npc_ann/stage', '/domains/people/turn']);
    assert.deepEqual(host.head().domains.people, next);
});

test('on: a sid that is not the head is STALE, a bad view is INVALID, and neither stores anything', async t => {
    const host = await peopleHost(t, { on: true });
    await host.send('Go.', 'The road.');
    const source = sourceOf(host);
    const stale = await send(host, { ...source, sid: `${source.sid}x` }, view());
    assert.equal(stale.code, 'STALE');
    const bads = [null, {}, view({ v: 2 }), view({ order: ['npc_bo'] }), view({ npcs: { npc_ann: [] } }), view({ turn: 1.5 }), view({ socialGraph: { x: () => 1 } }), view({ candidates: 'no' })];
    for (const bad of bads) assert.equal((await send(host, source, bad)).code, 'INVALID', JSON.stringify(bad));
    assert.equal(host.head().domains.people, undefined);
    assert.equal(opsOnHead(host).some(op => String(op.path).startsWith('/domains/people')), false);
});

test('on: the mirror receipt is not a reader edit (it never shows on the reply card)', async t => {
    const host = await peopleHost(t, { on: true });
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    const record = readRecord(host.ctx.chat[host.store.headIndex()]);
    const mine = record.receipts.filter(receipt => receipt.type === 'people.mirror');
    assert.equal(mine.length, 1);
    assert.notEqual(mine[0].data?.edit, true);
    assert.deepEqual(replyEdits(record), []);
});

test('on: an equal hash means the sender has nothing to send (the query is the comparison)', async t => {
    const host = await peopleHost(t, { on: true });
    await host.send('Go.', 'The road.');
    await send(host, sourceOf(host), view());
    assert.equal(hashJson(view()), host.sdk.query('people.hash'));
    assert.notEqual(hashJson(view({ turn: 2 })), host.sdk.query('people.hash'));
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
    assert.match(validatePeople(view({ portraitAssets: { 'x/y': 'p.png' } })).join(' '), /portrait/);
    assert.deepEqual(validatePeople('x'), ['The people domain is not an object.']);
});
