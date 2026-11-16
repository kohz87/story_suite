// The chat file's growth with people: 20 replies with 12 people. Each reply changes a few leaves (a stage, a note, the turn) and the sender writes the
// whole view; the bytes a reply adds to the chat stay bounded and do not climb with the reply number (a whole-array rewrite would climb).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const bytes = chat => Buffer.byteLength(JSON.stringify(chat));
const IDS = Array.from({ length: 12 }, (_, i) => `npc_p${i}`);
const record = (id, i, n) => ({ id, name: `Person ${i}`, look: 'tall, grey eyes, a long coat', habits: ['hums', 'taps the table'], stage: (n + i) % 4, note: i === n % 12 ? `met on reply ${n}` : 'seen', meters: { trust: 10 + ((n + i) % 7) } });
const view = (n, { growing = false } = {}) => ({
    v: 1, order: IDS, npcs: Object.fromEntries(IDS.map((id, i) => [id, record(id, i, n)])),
    candidates: [], dismissed: growing ? Array.from({ length: n }, (_, k) => ({ name: `Gone ${k}`, at: k })) : [], userDismissedGroups: [],
    socialGraph: { edges: IDS.slice(1).map((id, i) => ({ aId: IDS[i], bId: id, aToB: 'friend' })) }, portraitAssets: {}, turn: n,
});

async function run(t, options) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    const added = [];
    let last = bytes(host.ctx.chat);
    for (let n = 1; n <= 20; n++) {
        await host.send(`Turn ${n}.`, `Reply ${n}.`);
        const source = host.store.sourceAt(host.store.headIndex());
        const done = await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view: view(n, options) });
        assert.equal(done.ok, true, `${done.code}: ${done.message}`);
        const now = bytes(host.ctx.chat);
        added.push(now - last);
        last = now;
    }
    return added;
}
const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;

test('chat file size: bytes added per reply stay bounded with 12 people (20 replies)', async t => {
    const added = await run(t, {});
    console.log(`people size, steady: first reply ${added[0]} B, replies 2-20 min ${Math.min(...added.slice(1))} max ${Math.max(...added.slice(1))} mean ${Math.round(mean(added.slice(1)))} B`);
    const steady = added.slice(1);
    assert.ok(Math.max(...steady) < 6000, `a reply adds under 6000 bytes (max ${Math.max(...steady)})`);
    assert.ok(mean(steady.slice(-9)) <= mean(steady.slice(0, 9)) * 1.5 + 200, 'the later replies add no more than the earlier ones');
});

test('chat file size: a list that grows by one item a reply (dismissed) adds about its new item, not the whole list', async t => {
    const added = await run(t, { growing: true });
    console.log(`people size, growing dismissed list: replies 2-20 min ${Math.min(...added.slice(1))} max ${Math.max(...added.slice(1))} mean ${Math.round(mean(added.slice(1)))} B`);
    assert.ok(Math.max(...added.slice(1)) < 6000, `a reply adds under 6000 bytes (max ${Math.max(...added.slice(1))})`);
});
