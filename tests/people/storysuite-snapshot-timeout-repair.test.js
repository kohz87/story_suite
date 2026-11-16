// A timeline snapshot must answer inside its own budget even when the participant queue, a host-dependent write, or the vault is stuck.
// These tests use the production participant and the synthetic Story Block host; no live chat or files are involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipant, fileVault, memoryVault } from '../src/storysuite-participant/index.js';
import { adapterRig, BATCH, freshState, rig } from './helpers/participant-rig.js';
import { deferred, leaveIndexRepair, participantRig } from './storysuite-snapshot-timeout.helpers.js';

test('status runs a pending index repair before reporting a prepared return', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 35 });
    const saved = await r.delta.participant.checkpoint({});
    const prepared = await r.delta.participant.prepare({ return: 'rt_repair', checkpoint: saved.checkpoint, hash: saved.hash });
    assert.equal(prepared.ok, true);
    await leaveIndexRepair(r);
    const status = await r.delta.participant.status({ return: 'rt_repair' });
    assert.equal(status.status, 'prepared', status.message);
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

test('the host aborts its prepared return after repairing the participant index', { timeout: 3000 }, async t => {
    const r = await rig(t, { participantOptions: { boundMs: 35 } });
    await r.host.send('Hello.', 'The road is quiet.');
    const saved = await r.host.sdk.timeline.make({ kind: 'manual', name: 'First' });
    assert.equal(saved.ok, true, saved.message);
    assert.equal((await r.host.sdk.command('tl.seal', { id: BATCH.id })).ok, true);
    const head = await r.host.sdk.timeline.head();
    const prepared = await r.host.timeline.host.prepare({ snapshot: saved.snapshot.id, deathEvents: ['ev_death001'], batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    assert.equal(r.delta.index().returns[prepared.return].status, 'prepared');
    await leaveIndexRepair(r);
    const aborted = await r.host.timeline.host.abort({ prepared: prepared.prepared });
    assert.equal(aborted.status, 'aborted', aborted.message);
    assert.equal(r.delta.index().returns[prepared.return].status, 'aborted', 'the participant cleanup ran even though the host ignores its answer');
    assert.equal(Object.values(r.delta.index().prepared).some(entry => entry.return === prepared.return), false);
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

test('a host abort is retained when its first repair attempt also fails', { timeout: 3000 }, async t => {
    const r = await rig(t, { participantOptions: { boundMs: 35 } });
    await r.host.send('Hello.', 'The road is quiet.');
    const saved = await r.host.sdk.timeline.make({ kind: 'manual', name: 'First' });
    assert.equal((await r.host.sdk.command('tl.seal', { id: BATCH.id })).ok, true);
    const head = await r.host.sdk.timeline.head();
    const prepared = await r.host.timeline.host.prepare({ snapshot: saved.snapshot.id, deathEvents: ['ev_death001'], batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    await leaveIndexRepair(r);
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = (...args) => {
        if (first) { first = false; throw new Error('repair still unavailable'); }
        return putIndex(...args);
    };
    assert.equal((await r.host.timeline.host.abort({ prepared: prepared.prepared })).status, 'aborted');
    await r.delta.hydrate();
    assert.equal(r.delta.index().returns[prepared.return].status, 'aborted', 'cleanup is retried even though the host ignored the failure');
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

test('a failed abort index write is restored and the host cleanup is retried', { timeout: 3000 }, async t => {
    const r = await rig(t, { participantOptions: { boundMs: 35 } });
    await r.host.send('Hello.', 'The road is quiet.');
    const saved = await r.host.sdk.timeline.make({ kind: 'manual', name: 'First' });
    assert.equal((await r.host.sdk.command('tl.seal', { id: BATCH.id })).ok, true);
    const head = await r.host.sdk.timeline.head();
    const prepared = await r.host.timeline.host.prepare({ snapshot: saved.snapshot.id, deathEvents: ['ev_death001'], batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = async (...args) => {
        await putIndex(...args);
        if (first) { first = false; throw new Error('answer lost after write'); }
    };
    assert.equal((await r.host.timeline.host.abort({ prepared: prepared.prepared })).status, 'aborted');
    await r.delta.hydrate();
    assert.equal(r.delta.index().returns[prepared.return].status, 'aborted');
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

test('a deferred abort stays with its original chat when the active chat changes', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 35 });
    const saved = await r.delta.participant.checkpoint({});
    const prepared = await r.delta.participant.prepare({ return: 'rt_chat', checkpoint: saved.checkpoint, hash: saved.hash });
    await leaveIndexRepair(r);
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = async (...args) => {
        if (first) { first = false; entered.resolve(); await release.promise; }
        return putIndex(...args);
    };
    const aborting = r.delta.participant.abort({ return: 'rt_chat', prepared: prepared.prepared });
    await entered.promise;
    assert.equal((await aborting).code, 'STALE');
    r.live.chatKey = 'chat:avatar.png:other';
    release.resolve();
    await r.delta.hydrate();
    assert.equal(r.delta.index().returns.rt_chat.status, 'prepared', 'the other chat did not receive the abort');
    r.live.chatKey = 'chat:avatar.png:one';
    await r.delta.hydrate();
    assert.equal(r.delta.index().returns.rt_chat.status, 'aborted', 'cleanup follows the original chat');
});

test('other host callbacks do not wait behind a deferred abort write', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 35 });
    const saved = await r.delta.participant.checkpoint({});
    const prepared = await r.delta.participant.prepare({ return: 'rt_abort_wait', checkpoint: saved.checkpoint, hash: saved.hash });
    await leaveIndexRepair(r);
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let calls = 0;
    r.vault.putIndex = async (...args) => {
        calls += 1;
        if (calls === 2) { entered.resolve(); await release.promise; }
        return putIndex(...args);
    };
    const aborting = r.delta.participant.abort({ return: 'rt_abort_wait', prepared: prepared.prepared });
    await entered.promise;
    assert.equal((await aborting).code, 'STALE');
    const blocked = await r.delta.participant.activate({});
    assert.equal(blocked.code, 'STALE');
    assert.match(blocked.message, /finishing an earlier abort/);
    assert.equal((await r.delta.participant.status({ return: 'rt_abort_wait' })).code, 'STALE');
    release.resolve();
    await r.delta.hydrate();
    assert.equal((await r.delta.participant.status({ return: 'rt_abort_wait' })).status, 'aborted');
});

test('an abort waiting on a host-dependent repair releases the host and finishes cleanup afterwards', { timeout: 3000 }, async t => {
    const r = await rig(t, { participantOptions: { boundMs: 35 } });
    await r.host.send('Hello.', 'The road is quiet.');
    const saved = await r.host.sdk.timeline.make({ kind: 'manual', name: 'First' });
    assert.equal((await r.host.sdk.command('tl.seal', { id: BATCH.id })).ok, true);
    const head = await r.host.sdk.timeline.head();
    const prepared = await r.host.timeline.host.prepare({ snapshot: saved.snapshot.id, deathEvents: ['ev_death001'], batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    await leaveIndexRepair(r);
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = async (...args) => {
        if (first) {
            first = false;
            const answer = await r.host.sdk.timeline.forget({ snapshot: 'sn_missing' });
            assert.equal(answer.code, 'NOT_FOUND');
        }
        return putIndex(...args);
    };
    const aborted = await r.host.timeline.host.abort({ prepared: prepared.prepared });
    assert.equal(aborted.status, 'aborted');
    await r.delta.hydrate(); // follows the deferred abort in the participant queue
    assert.equal(r.delta.index().returns[prepared.return].status, 'aborted');
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

test('a stalled branch inheritance returns without minting a competing lineage', { timeout: 3000 }, async () => {
    const r = participantRig();
    const entered = deferred();
    const release = deferred();
    let pending = true;
    r.port.branchPending = () => pending;
    r.port.inheritBranch = async () => { entered.resolve(); await release.promise; pending = false; };
    const snapshot = r.delta.participant.checkpoint({});
    await entered.promise;
    const out = await snapshot;
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /inheriting the parent dossiers/);
    assert.equal(r.live.state.timeline, undefined);
    release.resolve();
    await r.delta.hydrate();
    assert.equal(r.vault.docs.size, 1, 'only the subsequent hydration made its baseline');
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});

test('a scan-idle promise that never answers still gives a retryable reason', { timeout: 3000 }, async () => {
    const r = participantRig();
    const release = deferred();
    r.port.idle = () => release.promise;
    const out = await r.delta.participant.checkpoint({});
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /waiting for dossier work/);
    assert.equal(r.vault.docs.size, 0);
    release.resolve(true);
    await r.delta.hydrate();
    assert.equal(r.vault.docs.size, 1, 'the expired snapshot did not resume when the scan became idle');
});

test('a scan-idle promise that never settles does not strand later callbacks', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 35 });
    r.port.idle = () => new Promise(() => {});
    const out = await r.delta.participant.checkpoint({});
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /waiting for dossier work/);
    delete r.port.idle;
    assert.equal((await r.delta.hydrate()).ok, true);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});
