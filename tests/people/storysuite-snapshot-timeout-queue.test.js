// A timeline snapshot must answer inside its own budget even when the participant queue, a host-dependent write, or the vault is stuck.
// These tests use the production participant and the synthetic Story Block host; no live chat or files are involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipant, fileVault, memoryVault } from '../../modules/people/legacy/storysuite-participant/index.js';
import { adapterRig, BATCH, freshState, rig } from './helpers/participant-rig.js';
import { deferred, participantRig } from './storysuite-snapshot-timeout.helpers.js';

test('a snapshot expires while an earlier participant operation holds the queue and does not run later', { timeout: 3000 }, async () => {
    const r = participantRig();
    const entered = deferred();
    const release = deferred();
    const write = r.port.writeTimeline;
    r.port.writeTimeline = async block => { entered.resolve(); await release.promise; await write(block); };
    const earlier = r.delta.hydrate();
    await entered.promise;
    const out = await r.delta.participant.checkpoint({ headHash: 'a'.repeat(64) });
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /waiting for earlier participant work/);
    assert.equal(r.vault.docs.size, 0);
    release.resolve();
    assert.equal((await earlier).ok, true);
    await r.delta.hydrate(); // follows the expired callback in the participant queue
    assert.equal(r.vault.docs.size, 1, 'only the earlier hydration made its baseline');
    const retry = await r.delta.participant.checkpoint({ headHash: 'a'.repeat(64) });
    assert.equal(retry.ok, true, retry.message);
});

test('host callbacks refuse promptly while an expired snapshot is still finishing', { timeout: 3000 }, async () => {
    const r = participantRig();
    const entered = deferred();
    const release = deferred();
    const write = r.port.writeTimeline;
    r.port.writeTimeline = async block => { entered.resolve(); await release.promise; await write(block); };
    const pending = r.delta.participant.checkpoint({});
    await entered.promise;
    assert.equal((await pending).code, 'STALE');
    const callbacks = [
        () => r.delta.participant.checkpoint({}),
        () => r.delta.participant.prepare({}),
        () => r.delta.participant.activate({}),
        () => r.delta.participant.abort({}),
        () => r.delta.participant.status({}),
        () => r.delta.participant.applyEvent({}),
    ];
    for (const callback of callbacks) {
        const out = await callback();
        assert.equal(out.code, 'STALE');
        assert.match(out.message, /still finishing an earlier timed-out save/);
    }
    let edited = false;
    r.delta.participant.attach({
        head: async () => ({ ok: true, headHash: 'a'.repeat(64) }),
        nativeMutation: async ({ prepare }) => {
            try { await prepare(); return { ok: true }; }
            catch (error) { return { ok: false, message: error.message }; }
        },
    });
    const native = await r.delta.nativeChange({ source: {}, edit: () => { edited = true; } });
    assert.match(native.message, /still finishing an earlier timed-out save/);
    assert.equal(edited, false, 'native preparation did not enter the blocked participant queue');
    release.resolve();
    assert.equal((await r.delta.hydrate()).ok, true);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});

test('a slow checkpoint file cannot publish a late snapshot or change the baseline', { timeout: 3000 }, async () => {
    const r = participantRig();
    await r.delta.hydrate();
    const before = r.delta.index().base;
    const entered = deferred();
    const release = deferred();
    const put = r.vault.put.bind(r.vault);
    r.vault.put = async (...args) => { entered.resolve(); await release.promise; return put(...args); };
    const pending = r.delta.participant.checkpoint({ headHash: 'b'.repeat(64) });
    await entered.promise;
    const out = await pending;
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /saving the native checkpoint/);
    assert.deepEqual(r.delta.index().base, before);
    release.resolve();
    await r.delta.hydrate();
    assert.deepEqual(r.delta.index().base, before);
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
    r.vault.put = put;
    assert.equal((await r.delta.participant.checkpoint({ headHash: 'b'.repeat(64) })).ok, true);
});

test('a late first baseline index is restored without installing or handing over the expired baseline', { timeout: 3000 }, async () => {
    const r = participantRig();
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    let candidate;
    r.vault.putIndex = async (...args) => {
        if (first) { first = false; candidate = structuredClone(args[1].base); entered.resolve(); await release.promise; }
        return putIndex(...args);
    };
    const pending = r.delta.participant.checkpoint({ headHash: 'f'.repeat(64) });
    await entered.promise;
    const out = await pending;
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /saving the participant index/);
    release.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(r.delta.index().base, null, 'the expired call did not install a baseline in memory');
    assert.equal((await r.vault.getIndex(r.delta.timeline().lineage)).base, null, 'the previous durable index was restored');
    assert.deepEqual(r.delta.participant.current(candidate), { ok: true, current: false });
    assert.equal(r.vault.docs.size, 1, 'only the baseline was made before the timeout');
    assert.equal((await r.delta.participant.checkpoint({ headHash: 'f'.repeat(64) })).ok, true);
    assert.deepEqual((await r.vault.getIndex(r.delta.timeline().lineage)).base, r.delta.index().base);
});

test('a failed first-baseline restoration is repaired before a later save', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 35 });
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let calls = 0;
    r.vault.putIndex = async (...args) => {
        calls += 1;
        if (calls === 1) { entered.resolve(); await release.promise; }
        if (calls === 2) throw new Error('index temporarily unavailable');
        return putIndex(...args);
    };
    const slow = r.delta.participant.checkpoint({});
    await entered.promise;
    assert.equal((await slow).code, 'STALE');
    release.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(r.delta.index().base, null);
    assert.equal((await r.delta.participant.checkpoint({})).code, 'STALE');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await r.vault.getIndex(r.delta.timeline().lineage)).base, null);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
});

for (const method of ['getIndex', 'put', 'putIndex']) {
    test(`a vault ${method} that never settles cannot strand the participant queue`, { timeout: 3000 }, async () => {
        const r = participantRig({ boundMs: 25, vaultTimeoutMs: 70 });
        const entered = deferred();
        const original = r.vault[method].bind(r.vault);
        let first = true;
        r.vault[method] = (...args) => {
            if (first) { first = false; entered.resolve(); return new Promise(() => {}); }
            return original(...args);
        };
        const slow = r.delta.participant.checkpoint({});
        await entered.promise;
        assert.equal((await slow).code, 'STALE');
        assert.equal((await r.delta.hydrate()).ok, true, 'the queue moves on without a reload');
        assert.equal((await r.delta.participant.checkpoint({})).ok, true);
        assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), r.delta.index());
    });
}

test('a stalled vault checkpoint read releases later host callbacks', { timeout: 3000 }, async () => {
    const r = participantRig({ vaultTimeoutMs: 60 });
    const saved = await r.delta.participant.checkpoint({});
    const get = r.vault.get.bind(r.vault);
    let first = true;
    r.vault.get = (...args) => {
        if (first) { first = false; return new Promise(() => {}); }
        return get(...args);
    };
    const failed = await r.delta.participant.prepare({ return: 'rt_stalled', checkpoint: saved.checkpoint, hash: saved.hash });
    assert.equal(failed.code, 'FAILED');
    assert.match(failed.message, /vault get did not answer/);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});

test('a file-vault response body that never settles cannot strand the queue', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 25, vaultTimeoutMs: 70 });
    let first = true;
    const file = fileVault({ headers: {}, fetchFn: async () => {
        if (first) { first = false; return { ok: true, json: () => new Promise(() => {}) }; }
        return { ok: false, status: 404 };
    } });
    r.vault.getIndex = file.getIndex;
    const out = await r.delta.participant.checkpoint({});
    assert.equal(out.code, 'STALE');
    assert.equal((await r.delta.hydrate()).ok, true);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});

test('a timed-out index write that finishes after a newer save is repaired to the newer index', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 25, vaultTimeoutMs: 70 });
    await r.delta.hydrate();
    const lineage = r.delta.timeline().lineage;
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = async (id, index) => {
        if (first) { first = false; entered.resolve(); await release.promise; }
        return putIndex(id, index);
    };
    const slow = r.delta.participant.checkpoint({ headHash: 'c'.repeat(64) });
    await entered.promise;
    assert.equal((await slow).code, 'STALE');
    assert.equal((await r.delta.hydrate()).ok, true);
    const saved = await r.delta.participant.checkpoint({ headHash: 'd'.repeat(64) });
    assert.equal(saved.ok, true, saved.message);
    const latest = r.delta.index();
    release.resolve();
    await new Promise(resolve => setImmediate(resolve));
    await r.delta.hydrate();
    assert.deepEqual(await r.vault.getIndex(lineage), latest, 'the late older write did not remain on disk');
    assert.deepEqual(r.delta.index(), latest);
});

test('an index write that persists but never answers is rolled back before the queue resumes', { timeout: 3000 }, async () => {
    const r = participantRig({ boundMs: 25, vaultTimeoutMs: 70 });
    await r.delta.hydrate();
    const before = r.delta.index();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let first = true;
    r.vault.putIndex = async (...args) => {
        if (first) {
            first = false;
            await putIndex(...args);
            return new Promise(() => {});
        }
        return putIndex(...args);
    };
    assert.equal((await r.delta.participant.checkpoint({ headHash: 'c'.repeat(64) })).code, 'STALE');
    assert.equal((await r.delta.hydrate()).ok, true);
    assert.deepEqual(r.delta.index(), before);
    assert.deepEqual(await r.vault.getIndex(r.delta.timeline().lineage), before);
    assert.equal((await r.delta.participant.checkpoint({})).ok, true);
});

test('a late participant-index write restores the previous baseline before later work', { timeout: 3000 }, async () => {
    const r = participantRig();
    await r.delta.hydrate();
    const lineage = r.delta.timeline().lineage;
    const before = r.delta.index().base;
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let candidate;
    let first = true;
    r.vault.putIndex = async (id, index) => {
        if (first) { first = false; candidate = structuredClone(index.base); entered.resolve(); await release.promise; }
        return putIndex(id, index);
    };
    const pending = r.delta.participant.checkpoint({ headHash: 'c'.repeat(64) });
    await entered.promise;
    const out = await pending;
    assert.equal(out.code, 'STALE');
    assert.match(out.message, /saving the participant index/);
    assert.deepEqual(r.delta.index().base, before);
    r.live.state.npcs[0].trust = 9;
    r.delta.noteChange();
    release.resolve();
    await r.delta.hydrate();
    assert.deepEqual(r.delta.index().base, before);
    assert.deepEqual((await r.vault.getIndex(lineage)).base, before, 'the durable index was restored');
    assert.equal(r.live.state.npcs[0].trust, 9, 'a newer native change remains live');
    assert.deepEqual(r.delta.participant.current(candidate), { ok: true, current: false }, 'the abandoned checkpoint was never handed over');
    assert.equal((await r.delta.participant.checkpoint({ headHash: 'c'.repeat(64) })).ok, true);
});

test('a failed index restoration holds later work until the previous baseline is durable', { timeout: 3000 }, async () => {
    const r = participantRig();
    await r.delta.hydrate();
    const lineage = r.delta.timeline().lineage;
    const before = r.delta.index().base;
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let calls = 0;
    r.vault.putIndex = async (id, index) => {
        calls += 1;
        if (calls === 1) { entered.resolve(); await release.promise; return putIndex(id, index); }
        if (calls <= 3) throw new Error('index temporarily unavailable');
        if (calls === 4) assert.deepEqual(index.base, before, 'the original baseline is repaired before the retry');
        return putIndex(id, index);
    };
    const pending = r.delta.participant.checkpoint({ headHash: 'd'.repeat(64) });
    await entered.promise;
    const out = await pending;
    assert.equal(out.code, 'STALE');
    release.resolve();
    await new Promise(resolve => setImmediate(resolve)); // the failed rollback is recorded before the next callback
    const blocked = await r.delta.participant.checkpoint({});
    assert.equal(blocked.code, 'STALE');
    assert.match(blocked.message, /still restoring the participant index/);
    assert.deepEqual(r.delta.index().base, before);
    await new Promise(resolve => setImmediate(resolve)); // the first background repair failed
    assert.equal((await r.delta.participant.checkpoint({})).code, 'STALE');
    await new Promise(resolve => setImmediate(resolve)); // the next background repair succeeded
    const retried = await r.delta.participant.checkpoint({ headHash: 'd'.repeat(64) });
    assert.equal(retried.ok, true, retried.message);
    assert.deepEqual((await r.vault.getIndex(lineage)).base, r.delta.index().base);
});
