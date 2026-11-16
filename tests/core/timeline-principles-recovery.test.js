// The timeline's rules as principles (docs/v2/TIMELINE.md): recovery readiness, single outstanding change, native change between checkpoint and commit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { BATCH, DEATH, NATIVE, NPC, clone, reload } from './helpers/timeline.js';
import { open, otherChat, world } from './timeline-principles.helpers.js';

// ---- 7. recovery never lets the host look ready on a story its native state has not caught up with -----------------------------

test('while a chat recovers, no listener sees the host ready and acts on a restored story with the native state not yet restored', async t => {
    // A module whose command depends on the native state: it records the dossier's trust.
    let trust = null;
    const trustModule = { id: 'tl-trust', name: 'Trust', version: '0.0.1', domains: { trustxp: { initial: () => ({ granted: null }), absent: () => ({ granted: null }) } }, commands: {
        'tl.trustxp'(ctx) {
            ctx.draft('trustxp').granted = trust();
            return { summary: 'Trust paid out.', narrate: false };
        },
    } };
    const w = await world(t, { wrap: native => { trust = () => native.native.store.dossiers.tavi.trust; } });
    // (the module has to be there from the start: register it, then rebuild the world's host on it)
    await w.host.sdk.registerModule(trustModule);
    const there = await otherChat(t);
    const head = await w.host.sdk.timeline.head();
    const prepared = await w.host.timeline.host.prepare({ snapshot: w.saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    w.native.native.fail.add('activate');
    const pending = await w.host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(pending.status, 'participants-pending');
    assert.equal(w.host.head().domains.progress.xp, 40, 'the story is restored');
    assert.equal(w.native.native.store.dossiers.tavi.trust, 99, 'the participant is not');
    w.native.native.fail.delete('activate');
    // Every time the host is told the modules are ready, a command that reads the native state is issued at once (synchronously, as a
    // listener would), and what the story and the participant stood at when the host announced it is kept.
    const heard = [];
    const issued = [];
    let listening = false;
    w.host.events.on('modules', ({ changes }) => {
        if (listening && w.host.registry.restore().state === 'idle' && changes.some(change => change.status === 'ready')) {
            heard.push({ xp: w.host.head().domains.progress?.xp, trust: w.native.native.store.dossiers.tavi.trust });
            issued.push(w.host.sdk.command('tl.trustxp', {}));
        }
    });
    const left = await open(w.host, there);
    listening = true;
    await open(w.host, left);
    await Promise.all(issued);
    assert.equal(heard.length >= 1, true, 'the host was announced ready');
    assert.deepEqual(heard.filter(each => each.xp === 40 && each.trust === 99), [], 'never announced ready on the restored story with the dead timeline\'s native state');
    assert.equal(w.native.native.store.dossiers.tavi.trust, 3);
    assert.equal(w.host.registry.restore().state, 'idle');
    const granted = w.host.head().domains.trustxp?.granted ?? null;
    assert.equal(granted === null || granted === 3, true, `trust paid out against ${granted}`);
    assert.equal(w.host.store.problems().length, 0);
});

test('a journal that holds two unfinished changes (damaged: the API refuses a second) keeps the chat barred and announces nothing ready', async t => {
    const w = await world(t);
    const there = await otherChat(t);
    for (const n of [1, 2]) {
        w.host.timeline.archive.add({ id: `nm_inject0${n}`, kind: 'native-event', phase: 'prepared', session: 'ss_oldrun01', participant: NATIVE, event: `ev_inject0${n}`,
            eventKind: 'confirmed-death', nativeKey: 'tavi', npc: NPC, expectedHead: 'a'.repeat(64), before: { module: NATIVE, checkpoint: 'ck_00000001', hash: 'b'.repeat(64), schema: 1 }, after: null,
            boundary: { cursor: { sid: 'sr_00000001', swipeKey: 'sw_00000001', block: 'bl_00000001', op: 0, rev: 1 }, prefixHash: 'c'.repeat(64) } });
    }
    const left = await open(w.host, there);
    const heard = [];
    w.host.events.on('modules', ({ changes }) => { if (changes.some(change => change.status === 'ready')) heard.push(w.host.registry.restore().state); });
    await open(w.host, left);
    assert.equal(w.host.registry.restore().state, 'pending', 'held');
    assert.deepEqual(heard, [], 'never announced ready');
    assert.equal((await w.host.sdk.command('tl.xp', { amount: 1 })).ok, false, 'commands stay barred');
    const result = await w.host.timeline.recover();
    assert.equal(result.ok, false);
    assert.match(result.message, /2 unfinished changes/);
    assert.equal(w.native.native.calls.some(call => call.name === 'applyEvent'), false, 'the participant was not asked to change');
});

// ---- 8. at most one change is outstanding in a chat, and the barrier holds until every one has settled ---------------------------

const PENDING_EVENT = { event: 'ev_pending001', participant: NATIVE, kind: 'confirmed-death', npc: NPC };

// A restore prepared, and then a native event that is left outstanding (its journal could not be saved, or its participant failed).
async function interleaved(t, how) {
    const w = await world(t, { scenario: 'a native event' });
    const head = await w.host.sdk.timeline.head();
    const prepared = await w.host.timeline.host.prepare({ snapshot: w.saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    const input = { ...PENDING_EVENT, expectedHead: head.headHash };
    if (how === 'journal') {
        w.counter.n = 0;
        w.counter.failing = 1;
    } else {
        w.native.native.fail.add('applyEvent');
    }
    const event = await w.host.timeline.host.nativeEvent(input);
    assert.equal(event.ok, false, 'the event is left outstanding');
    w.counter.failing = 0;
    const heard = [];
    w.host.events.on('modules', ({ changes }) => { if (changes.some(change => change.status === 'ready')) heard.push(w.host.registry.restore().state); });
    return { w, head, prepared, input, heard, activate: () => w.host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash }) };
}

for (const how of ['journal', 'participant']) {
    test(`a prepared restore is not activated while a native event is outstanding (${how} failed): RESTORE_PENDING, the barrier holds, nothing is announced ready`, async t => {
        const { w, activate, heard, prepared } = await interleaved(t, how);
        const refused = await activate();
        assert.equal(refused.ok, false);
        assert.equal(refused.code, 'RESTORE_PENDING');
        assert.equal(w.host.registry.restore().state, 'pending', 'still barred');
        assert.deepEqual(heard, [], 'never announced ready');
        assert.equal((await w.host.sdk.timeline.status()).state, 'pending');
        assert.equal((await w.host.sdk.command('tl.xp', { amount: 7 })).ok, false, 'no command goes through');
        assert.equal(w.host.head().domains.progress.xp, 140, 'the story is not restored');
        assert.equal(w.host.timeline.host.journal().find(entry => entry.id === prepared.prepared).phase, 'prepared', 'the restore stays prepared');
        assert.equal(w.host.timeline.host.journal().filter(entry => (entry.kind === 'restore' && ['committed', 'participants-pending', 'acked'].includes(entry.phase)) || (entry.kind === 'native-event' && entry.phase === 'prepared')).length, 1, 'one outstanding change');
    });

    test(`recovery route (${how} failed): retrying the identical event settles it; the restore, prepared on the head before it, is then STALE and is prepared again`, async t => {
        const { w, activate, input, prepared } = await interleaved(t, how);
        assert.equal((await activate()).code, 'RESTORE_PENDING');
        w.native.native.fail.delete('applyEvent');
        const again = await w.host.timeline.host.nativeEvent(input);
        assert.equal(again.ok, true, again.message);
        assert.equal(w.host.registry.restore().state, 'idle');
        assert.equal((await w.host.sdk.timeline.status()).state, 'idle');
        // The native change is part of the head: the restore prepared before it no longer stands.
        const stale = await activate();
        assert.equal(stale.code, 'STALE');
        assert.equal(w.host.timeline.host.journal().find(entry => entry.id === prepared.prepared).phase, 'aborted');
        const head = await w.host.sdk.timeline.head();
        const fresh = await w.host.timeline.host.prepare({ snapshot: w.saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
        assert.equal(fresh.ok, true, fresh.message);
        const done = await w.host.timeline.host.activate({ prepared: fresh.prepared, expectedHead: head.headHash });
        assert.equal(done.status, 'complete');
        assert.equal(w.host.head().domains.progress.xp, 40);
    });
}

test('recovery route after a restart: the outstanding event is finished when the chat opens and the prepared restore beside it is aborted', async t => {
    const { w, activate, prepared } = await interleaved(t, 'participant');
    assert.equal((await activate()).code, 'RESTORE_PENDING');
    w.native.native.fail.delete('applyEvent');
    const again = await reload(createHost, clone(w.disk.image), w.modules());
    t.after(() => again.close());
    assert.equal(again.registry.restore().state, 'idle');
    assert.equal((await again.sdk.timeline.status()).state, 'idle');
    const entries = again.timeline.host.journal();
    assert.equal(entries.find(entry => entry.kind === 'native-event').phase, 'done');
    assert.equal(entries.find(entry => entry.id === prepared.prepared).phase, 'aborted');
    assert.equal(w.native.native.store.applied.includes(PENDING_EVENT.event), true, 'the participant has the event');
    assert.equal((await again.sdk.command('tl.xp', { amount: 7 })).ok, true);
});

// ---- 9. a participant's native change between its checkpoint and the commit ------------------------------------------------------

test('a participant whose state changed after its checkpoint holds the commit of a save point: STALE, nothing written, nothing announced; the retry works', async t => {
    const { hashJson } = await import('../../core/replay.js');
    const w = await world(t, { wrap: native => {
        native.def.participant.current = ({ hash }) => ({ ok: true, current: hashJson(native.native.store) === hash });
    } });
    const before = Object.keys(w.host.head().domains.savepoints.points).length;
    const told = w.told.length;
    w.hook.on = phase => { if (phase === 'make.archived') w.native.native.edit(state => { state.dossiers.tavi.trust = 55; }); };
    const made = await w.host.sdk.timeline.make({ kind: 'manual', name: 'Raced' });
    assert.equal(made.ok, false);
    assert.equal(made.code, 'STALE');
    assert.match(made.message, /tl-native changed its state/);
    assert.equal(Object.keys(w.host.head().domains.savepoints.points).length, before, 'no descriptor');
    assert.equal(w.told.length, told, 'nothing announced');
    assert.equal(w.host.timeline.host.journal().filter(entry => entry.kind === 'make').at(-1).phase, 'discarded');
    // The state stays as it is now and the retry hands over that state.
    w.hook.on = null;
    const again = await w.host.sdk.timeline.make({ kind: 'manual', name: 'Retried' });
    assert.equal(again.ok, true, again.message);
    assert.equal(again.snapshot.participants[0].hash, hashJson(w.native.native.store));
});

test('a probe that throws, answers a promise or answers something else fails closed; a participant without a probe keeps today\'s behaviour', async t => {
    for (const answer of [() => { throw new Error('boom'); }, () => Promise.resolve({ ok: true, current: true }), () => true, () => ({ ok: false }), () => ({ ok: true }), () => undefined]) {
        const w = await world(t, { wrap: native => { native.def.participant.current = answer; } });
        const made = await w.host.sdk.timeline.make({ kind: 'manual', name: 'Probed' });
        assert.equal(made.code, 'STALE', String(answer));
    }
    const w = await world(t);
    w.hook.on = phase => { if (phase === 'make.archived') w.native.native.edit(state => { state.dossiers.tavi.trust = 55; }); };
    assert.equal((await w.host.sdk.timeline.make({ kind: 'manual', name: 'No probe' })).ok, true, 'no probe: the head hash alone, as before');
    const bad = await w.host.timeline.host.registerParticipant({ module: 'tl-bad', schema: 1, current: 'yes', ...Object.fromEntries(['checkpoint', 'prepare', 'activate', 'abort', 'status'].map(name => [name, () => ({ ok: true })])) });
    assert.equal(bad.code, 'INVALID');
});
