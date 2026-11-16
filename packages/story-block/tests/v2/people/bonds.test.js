// The people domain's second writer (P4): `people.bonds` stores the meters a module's own command made, inside its transaction, and only from a module;
// `people.write` keeps them; `people.hash { dossiers: true }` leaves out `bonds` and `scan`; the scan marker rides on people.write; replay == live
// across swipes, deletes, a rebuild and a reload. Also the known limit of a deferred domain: deleting the reply that made it loses the later writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { hashJson } from '../../../src/v2/replay.js';
import { carriers, rebuildAt } from '../qa/helpers/oracle.js';

const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)));
// A module whose own command moves a meter by calling people.bonds (as NPC State's change lines do).
const meters = () => ({
    id: 'qa-meters',
    name: 'QA meters',
    commands: {
        'qa.move': {
            handler(ctx, payload) {
                const bonds = plain(ctx.read('people')?.bonds) ?? { npcs: {}, problems: [] };
                const record = bonds.npcs[payload.id] ?? { name: payload.id, meters: { trust: 0 } };
                record.meters.trust += payload.by;
                bonds.npcs[payload.id] = record;
                ctx.call('people.bonds', { bonds });
                return { summary: 'moved' };
            },
        },
    },
});
async function rig(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [meters()] });
    t.after(() => host.close());
    return host;
}
const sourceOf = host => { const s = host.store.sourceAt(host.store.headIndex()); return { sid: s.sid, swipeKey: s.swipeKey }; };
const view = (extra = {}) => ({ v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1, ...extra });
const write = (host, v, scan) => host.sdk.command('people.write', { v: 1, source: sourceOf(host), view: v, ...(scan ? { scan } : {}) });
const move = (host, id, by) => host.sdk.command('qa.move', { id, by });
const trust = (host, id) => host.head().domains.people?.bonds?.npcs?.[id]?.meters?.trust;

function assertReplay(host, label) {
    for (const index of carriers(host.ctx.chat)) {
        const { state } = rebuildAt(host.ctx.chat, index);
        if (state !== null) assert.deepEqual(plain(host.store.at(index)), plain(state), `${label}: carrier ${index}`);
    }
}

test('a module command stores bonds; people.write keeps them and the bonds keep the dossiers', async t => {
    const host = await rig(t);
    await host.send('Go.', 'The road.');
    assert.equal((await move(host, 'npc_ann', 4)).ok, true);
    assert.equal(trust(host, 'npc_ann'), 4);
    assert.equal(host.sdk.query('people.hash', { dossiers: true }), null, 'a slice made by bonds alone holds no dossier');
    assert.equal((await write(host, view())).ok, true);
    assert.equal(trust(host, 'npc_ann'), 4, 'the dossier write kept the bonds');
    assert.equal(host.sdk.query('people.hash', { dossiers: true }), hashJson(view()));
    assert.equal((await move(host, 'npc_ann', 2)).ok, true);
    assert.deepEqual(host.head().domains.people.npcs, view().npcs, 'the bonds write kept the dossiers');
    assert.equal(host.sdk.query('people.hash', { dossiers: true }), hashJson(view()), 'a meter move does not change the dossier hash');
    assert.notEqual(host.sdk.query('people.hash'), hashJson(view()), 'the whole-slice hash does');
});

test('people.bonds is refused from a page or a reader button, and a view or bonds that is not sound stores nothing', async t => {
    const host = await rig(t);
    await host.send('Go.', 'The road.');
    assert.equal((await host.sdk.command('people.bonds', { bonds: { npcs: {} } })).code, 'REFUSED');
    assert.equal((await write(host, view({ bonds: { npcs: {} } }))).code, 'INVALID', 'a view cannot carry bonds');
    assert.equal((await write(host, view(), { lastSid: '', swipeKey: 'k', since: 0 })).code, 'INVALID');
    const bad = await host.sdk.command('qa.move', { id: 'ann', by: 1 });
    assert.equal(bad.ok, false, 'a bond keyed by a name, not an npc_ id');
    assert.equal(host.head().domains.people, undefined);
});

test('the scan marker rides on people.write, stays when a write leaves it out, and is not in the dossier hash', async t => {
    const host = await rig(t);
    await host.send('Go.', 'The road.');
    const scan = { lastSid: sourceOf(host).sid, swipeKey: sourceOf(host).swipeKey, since: 0 };
    assert.equal((await write(host, view(), scan)).ok, true);
    assert.deepEqual(host.head().domains.people.scan, scan);
    assert.equal(host.sdk.query('people.hash', { dossiers: true }), hashJson(view()));
    await host.send('On.', 'Further.');
    assert.equal((await write(host, view({ turn: 2 }))).ok, true);
    assert.deepEqual(host.head().domains.people.scan, scan, 'a write without a marker keeps the stored one');
});

test('replay == live for bonds and scan: replies, a swipe and back, a middle delete, a rebuild, a reload', async t => {
    const host = await rig(t);
    for (let n = 1; n <= 4; n++) {
        await host.send(`Turn ${n}.`, `Reply ${n}.`);
        await write(host, view({ turn: n }), { lastSid: sourceOf(host).sid, swipeKey: sourceOf(host).swipeKey, since: 0 });
        await move(host, n % 2 ? 'npc_ann' : 'npc_bo', n);
        assertReplay(host, `reply ${n}`);
    }
    const before = plain(host.head().domains.people);
    await host.swipe('Reply 4b.');
    await move(host, 'npc_ann', 10);
    assertReplay(host, 'swipe');
    assert.equal(trust(host, 'npc_ann'), 1 + 3 + 10);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.deepEqual(plain(host.head().domains.people), before, 'swiping back restores the first swipe');
    await host.st.deleteMessage(carriers(host.ctx.chat)[3]);
    assertReplay(host, 'middle delete');
    await host.store.rebuild();
    assertReplay(host, 'rebuild');
    const image = { chat: plain(host.ctx.chat), metadata: plain(host.ctx.chatMetadata) };
    const again = await createHost({ modules: [meters()] });
    t.after(() => again.close());
    again.ctx.chatMetadata = image.metadata;
    await again.st.loadChat(image.chat);
    assert.deepEqual(plain(again.head().domains.people), plain(host.head().domains.people), 'reload');
});

test('known limit (deferred domain): deleting the reply that made the people slice loses the later writes on it', async t => {
    const host = await rig(t);
    await host.send('One.', 'First.');
    await move(host, 'npc_ann', 1);
    await host.send('Two.', 'Second.');
    await move(host, 'npc_bo', 2);
    await host.st.deleteMessage(carriers(host.ctx.chat)[1]);
    assert.equal(host.head().domains.people, undefined, 'the store skips writes whose parent is gone; the slice made by the deleted reply is gone with them');
    assertReplay(host, 'after the delete');
});
