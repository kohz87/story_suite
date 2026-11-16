// The timeline's rules as principles (docs/v2/TIMELINE.md): in-memory state belongs to one chat, and the line of work is chat-bound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clone } from '../../packages/story-block/tests/v2/helpers/timeline.js';
import { HOLD_AT, SCENARIOS, announced, hold, open, otherChat, until, world } from './timeline-principles.helpers.js';

// ---- 5. in-memory state belongs to one chat ------------------------------------------------------------------------------------

for (const [name, scenario] of Object.entries(SCENARIOS)) {
    test(`${name}: after a save failed at any position, opening another chat announces nothing of the first and leaves it no barrier; the first chat's own recovery settles it`, async t => {
        const dry = await world(t, { scenario: name, more: true });
        assert.equal((await scenario.run(dry)).ok, true);
        const total = dry.counter.n;
        const there = await otherChat(t);
        for (let at = 1; at <= total; at++) {
            const w = await world(t, { failing: at, scenario: name, more: true });
            await scenario.run(w);
            assert.equal(w.counter.failed, true);
            const left = await open(w.host, there);
            const before = announced(w).length;
            const made = await w.host.sdk.timeline.make({ kind: 'manual', name: 'In the other chat' });
            assert.equal(made.ok, true, `flush ${at}: the other chat is not held by the first one's barrier (${made.code} ${made.message})`);
            assert.equal(w.host.registry.restore().state, 'idle', `flush ${at}`);
            const inB = new Set(w.host.store.receipts().map(each => each.receipt.id));
            for (const each of w.told.slice(before)) assert.equal(inB.has(each.id), true, `flush ${at}: ${each.type} is not in the chat that was announced to`);
            // The way back: the chat that was left finds its own journal and settles it.
            await open(w.host, left);
            assert.equal(w.host.registry.restore().state, 'idle', `flush ${at}: back in the first chat`);
            assert.equal((await w.host.sdk.timeline.status()).state, 'idle', `flush ${at}: back in the first chat`);
            for (const each of w.told) assert.equal(each.present && each.onDisk, true, `flush ${at}: ${each.type} announced without the file and the chat having it`);
        }
    });

    test(`${name}: after a save failed at any position, deleting the reply that holds the work announces nothing the chat no longer has, and recovery leaves no barrier`, async t => {
        const dry = await world(t, { scenario: name, more: true });
        assert.equal((await scenario.run(dry)).ok, true);
        const total = dry.counter.n;
        for (let at = 1; at <= total; at++) {
            const w = await world(t, { failing: at, scenario: name, more: true });
            await scenario.run(w);
            assert.equal(w.counter.failed, true);
            const before = announced(w).length;
            await w.host.st.deleteMessage(w.host.ctx.chat.length - 1);
            assert.equal((await w.host.timeline.recover()).ok, true, `flush ${at}`);
            const made = await w.host.sdk.timeline.make({ kind: 'manual', name: 'After the delete' });
            assert.equal(made.ok, true, `flush ${at}: ${made.code} ${made.message}`);
            assert.equal(w.host.registry.restore().state, 'idle', `flush ${at}`);
            for (const each of w.told.slice(before)) assert.equal(each.present && each.onDisk, true, `flush ${at}: ${each.type} was announced though the chat no longer has it`);
        }
    });

    test(`${name}: a save that is refused because the chat was left meanwhile is STALE, not a failed save, and drops the barrier`, async t => {
        const dry = await world(t, { scenario: name, more: true });
        assert.equal((await scenario.run(dry)).ok, true);
        const total = dry.counter.n;
        const there = await otherChat(t);
        for (let at = 1; at <= total; at++) {
            const w = await world(t, { failing: at, scenario: name, more: true, onFail: host => open(host, there) });
            const result = await scenario.run(w);
            assert.equal(result.ok, false, `flush ${at}`);
            assert.equal(result.code, 'STALE', `flush ${at}: ${result.code} ${result.message}`);
            assert.equal(w.host.registry.restore().state, 'idle', `flush ${at}: no barrier on the chat that is open`);
            assert.deepEqual(w.host.ctx.chatMetadata.storySuite?.timeline, there.snapshot.storySuite?.timeline, `flush ${at}: no timeline written to the chat that is open`);
            there.metadata = clone(there.snapshot);
            await open(w.host, { chat: there.chat, metadata: there.metadata });
        }
    });
}

// ---- 6. the line of work is chat-bound too ---------------------------------------------------------------------------------------

test('a save queued in a chat that is left is STALE when its turn comes: it does not run in the chat that is open', async t => {
    const w = await world(t);
    const there = await otherChat(t);
    const gate = hold(w, 'make.checkpointed');
    const first = w.host.sdk.timeline.make({ kind: 'manual', name: 'A first' });
    await until(gate.reached);
    const queued = [w.host.sdk.timeline.make({ kind: 'manual', name: 'A queued' }), w.host.sdk.command('savepoint.make', { name: 'A queued too' })];
    const left = await open(w.host, there);
    gate.release();
    for (const result of [await first, ...await Promise.all(queued)]) {
        assert.equal(result.ok, false);
        assert.equal(result.code, 'STALE', result.message);
    }
    assert.equal(w.host.head().domains.savepoints, undefined, 'nothing was made in the chat that is open');
    assert.equal(w.host.ctx.chatMetadata.storySuite?.timeline, undefined);
    // The chat that was left still works when it is open again.
    await open(w.host, left);
    assert.equal((await w.host.sdk.timeline.make({ kind: 'manual', name: 'Back' })).ok, true);
});

test('a chat opened with an unfinished journal is barred at once, even while another chat\'s work holds the line; its recovery runs in its turn', async t => {
    const w = await world(t, { failing: 1, scenario: 'a native event' });
    const there = await otherChat(t);
    const failed = await SCENARIOS['a native event'].run(w);
    assert.equal(failed.code, 'FAILED');
    assert.equal(w.host.registry.restore().state, 'pending');
    const left = await open(w.host, there);
    assert.equal(w.host.registry.restore().state, 'idle', 'the other chat is not held by the first one\'s barrier');
    const gate = hold(w, 'make.checkpointed');
    const inB = w.host.sdk.timeline.make({ kind: 'manual', name: 'B holds the line' });
    await until(gate.reached);
    const reopening = open(w.host, left);
    assert.equal(await until(() => w.host.registry.restore().state === 'pending'), true, 'barred from the moment it is open');
    const xp = await w.host.sdk.command('tl.xp', { amount: 1 });
    assert.equal(xp.ok, false, 'no command goes through while its recovery waits');
    assert.equal(w.host.head().domains.progress.xp, 140);
    gate.release();
    assert.equal((await inB).code, 'STALE', 'B\'s work, with the chat gone');
    await reopening;
    assert.equal(w.host.registry.restore().state, 'idle');
    assert.equal((await w.host.sdk.timeline.status()).state, 'idle');
    assert.equal(w.host.timeline.host.journal().find(entry => entry.kind === 'native-event').phase, 'done', 'its own recovery finished it');
    assert.equal((await w.host.sdk.command('tl.xp', { amount: 1 })).ok, true);
});

for (const [name, scenario] of Object.entries(SCENARIOS)) {
    const settles = async (w, left) => {
        await open(w.host, left);
        assert.equal((await w.host.timeline.recover()).ok, true);
        assert.equal(w.host.registry.restore().state, 'idle');
        assert.equal((await w.host.sdk.timeline.status()).state, 'idle');
        assert.equal(w.host.timeline.host.journal().every(entry => ['committed', 'discarded', 'aborted', 'complete', 'done', 'retracted'].includes(entry.phase)), true, 'nothing is left unfinished');
        for (const each of w.told) assert.equal(each.present && each.onDisk, true, `${each.type} announced without the file and the chat having it`);
    };

    test(`${name}: held in a chat, work queued behind it, the chat left, released: everything is STALE, nothing runs in the other chat, and the first chat recovers when reopened`, async t => {
        const w = await world(t, { scenario: name });
        const there = await otherChat(t);
        const gate = hold(w, HOLD_AT[name]);
        const running = scenario.run(w);
        await until(gate.reached);
        const queued = w.host.sdk.timeline.make({ kind: 'manual', name: 'Queued' });
        const left = await open(w.host, there);
        gate.release();
        const result = await running;
        assert.equal(result.ok, false, name);
        assert.equal(result.code, 'STALE', `${result.code} ${result.message}`);
        assert.equal((await queued).code, 'STALE');
        assert.equal(w.host.registry.restore().state, 'idle', 'no barrier on the chat that is open');
        assert.equal(w.host.ctx.chatMetadata.storySuite?.timeline, undefined, 'nothing written to the chat that is open');
        await settles(w, left);
    });

    test(`${name}: held in a chat, the chat left, work of the other chat queued behind it, released: the other chat's work runs in the other chat only`, async t => {
        const w = await world(t, { scenario: name });
        const there = await otherChat(t);
        const gate = hold(w, HOLD_AT[name]);
        const running = scenario.run(w);
        await until(gate.reached);
        const left = await open(w.host, there);
        const inB = w.host.sdk.timeline.make({ kind: 'manual', name: 'B made' });
        gate.release();
        assert.equal((await running).code, 'STALE');
        const made = await inB;
        assert.equal(made.ok, true, made.message);
        assert.deepEqual(Object.values(w.host.head().domains.savepoints.points).map(point => point.name), ['B made']);
        await settles(w, left);
    });

    test(`${name}: held in a chat, the chat left and opened again before the release: the work is still that chat's and finishes, or is STALE; nothing is lost or doubled`, async t => {
        const w = await world(t, { scenario: name });
        const there = await otherChat(t);
        const gate = hold(w, HOLD_AT[name]);
        const running = scenario.run(w);
        await until(gate.reached);
        const left = await open(w.host, there);
        const back = open(w.host, left);
        gate.release();
        const result = await running;
        await back;
        assert.equal(result.ok || result.code === 'STALE', true, `${result.code} ${result.message}`);
        assert.equal(w.breaches.length, 0);
        await settles(w, left);
        const entries = w.host.timeline.host.journal();
        assert.equal(entries.filter(entry => entry.kind === 'native-event').length <= 1, true, 'the event was not delivered twice');
    });
}
