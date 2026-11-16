// The restore protocol (docs/v2/TIMELINE.md, contract §8): stale heads, unavailable snapshots, abort,
// participants-pending barriers, status timeouts, recover, and guarded blocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { RETRY_SCHEDULE_MS } from '../../core/timeline/coordinator-block.js';
import { PARTICIPANT_TIMEOUT_MS } from '../../core/timeline/participants.js';
import { director } from './helpers/evidence.js';
import { BATCH, DEATH, NATIVE, batchFor, clone, nativeModule, rulesModule, seal, slice } from './helpers/timeline.js';
import { cmd, reply, story } from './timeline-restore.helpers.js';

test('a stale head is STALE: at prepare, at activate (the preparation is aborted), and a make in between moves it', async t => {
    const { host, native, saved } = await story(t);
    const head = await host.sdk.timeline.head();
    const input = { snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash };
    const prepared = await host.timeline.host.prepare(input);
    assert.equal(prepared.ok, true);
    await cmd(host, 'tl.xp', { amount: 1 });
    const stale = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(stale.code, 'STALE');
    assert.equal(host.timeline.host.journal().find(each => each.id === prepared.prepared).phase, 'aborted');
    assert.equal(native.native.calls.some(call => call.name === 'abort'), true, 'the participant was told to release its precommit work');
    assert.equal(host.head().domains.progress.xp, 141, 'nothing was restored');
    assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).code, 'REFUSED', 'an aborted token is dead');
    // A stale prepare is not prepared at all.
    assert.equal((await host.timeline.host.prepare(input)).code, 'STALE');
    // The right head again: the same batch can be prepared anew (the aborted attempt does not hold it).
    const fresh = await host.sdk.timeline.head();
    const again = await host.timeline.host.prepare({ ...input, expectedHead: fresh.headHash });
    assert.equal(again.ok, true, again.message);
    assert.notEqual(again.prepared, prepared.prepared);
    // activate's own expectedHead must be the one that was prepared.
    assert.equal((await host.timeline.host.activate({ prepared: again.prepared, expectedHead: head.headHash })).code, 'STALE');
    assert.equal(host.head().domains.progress.xp, 141);
    // A make between prepare and activate moves the head.
    const third = await host.timeline.host.prepare({ ...input, expectedHead: (await host.sdk.timeline.head()).headHash });
    await host.sdk.timeline.make({ kind: 'manual', name: 'Between' });
    assert.equal((await host.timeline.host.activate({ prepared: third.prepared, expectedHead: third.ok ? (await host.sdk.timeline.head()).headHash : '' })).code, 'STALE');
});

test('missing native bytes give SNAPSHOT_UNAVAILABLE: the archive\'s, a participant\'s, a missing or changed participant', async t => {
    const { host, native, saved } = await story(t);
    const attempt = async () => {
        const head = await host.sdk.timeline.head();
        return host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    };
    const before = slice(host.head());
    // The participant's checkpoint bytes are gone: the participant says so, nothing is restored, the others are released.
    native.native.missing.add(saved.participants[0].checkpoint);
    const gone = await attempt();
    assert.equal(gone.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(gone.message, /tl-native/);
    native.native.missing.clear();
    assert.equal(host.timeline.host.journal().findLast(entry => entry.kind === 'restore').phase, 'aborted');
    // The archived payload is gone, or was changed.
    const archive = host.ctx.chatMetadata.storySuite.timeline;
    const bytes = archive.payloads[saved.payloadHash];
    delete archive.payloads[saved.payloadHash];
    assert.equal((await attempt()).code, 'SNAPSHOT_UNAVAILABLE');
    archive.payloads[saved.payloadHash] = bytes;
    bytes.payload.domains.progress.xp = 1000000;
    const tampered = await attempt();
    assert.equal(tampered.code, 'SNAPSHOT_UNAVAILABLE', 'bytes that do not hash to the descriptor\'s payloadHash are not bytes');
    bytes.payload.domains.progress.xp = 40;
    // A participant the save held is not registered (a host without the module) or reads another schema.
    const lonely = await createHost({ modules: [rulesModule(), director()], st: { chat: clone(host.ctx.chat) } });
    t.after(() => lonely.close());
    lonely.ctx.chatMetadata = clone(host.ctx.chatMetadata);
    await lonely.turn.onChatChanged();
    const alone = await lonely.sdk.timeline.head();
    const lack = await lonely.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: alone.headHash });
    assert.equal(lack.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(lack.message, /tl-native.*not registered/);
    const other = nativeModule();
    other.def.participant.schema = 2;
    const odd = await createHost({ modules: [rulesModule(), other.def, director()], st: { chat: clone(host.ctx.chat) } });
    t.after(() => odd.close());
    odd.ctx.chatMetadata = clone(host.ctx.chatMetadata);
    await odd.turn.onChatChanged();
    const misread = await odd.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: (await odd.sdk.timeline.head()).headHash });
    assert.equal(misread.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(misread.message, /schema/);
    // A participant that arrived after the save has native state the save never held.
    const late = nativeModule({ id: 'tl-late' });
    late.def.domains = {};
    await host.sdk.registerModule(late.def);
    const extra = await attempt();
    assert.equal(extra.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(extra.message, /tl-late/);
    assert.deepEqual(slice(host.head()), before, 'in every case the story stayed where it was');
    assert.equal(host.registry.restore().state, 'idle');
});

test('bytes that vanish between prepare and activate abort the restore (SNAPSHOT_UNAVAILABLE)', async t => {
    const { host, saved } = await story(t);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    delete host.ctx.chatMetadata.storySuite.timeline.payloads[saved.payloadHash];
    const result = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(result.code, 'SNAPSHOT_UNAVAILABLE');
    assert.equal(host.head().domains.progress.xp, 140);
    assert.equal(host.timeline.host.journal().find(each => each.id === prepared.prepared).phase, 'aborted');
});

test('abort: before the commit it releases everything and is idempotent; after the commit it is REFUSED', async t => {
    const { host, native, saved } = await story(t);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.deepEqual(await host.timeline.host.abort({ prepared: prepared.prepared }), { ok: true, status: 'aborted' });
    assert.deepEqual(await host.timeline.host.abort({ prepared: prepared.prepared }), { ok: true, status: 'aborted' }, 'again');
    assert.equal(native.native.calls.filter(call => call.name === 'abort').length, 1);
    assert.equal((await host.timeline.host.abort({})).code, 'INVALID');
    assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).code, 'REFUSED');
    assert.equal(host.head().domains.progress.xp, 140);
    // Prepared anew, activated: abort is too late.
    const again = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    const done = await host.timeline.host.activate({ prepared: again.prepared, expectedHead: head.headHash });
    assert.equal(done.status, 'complete');
    assert.equal((await host.timeline.host.abort({ prepared: again.prepared })).code, 'REFUSED');
    // Activating a completed restore again answers what it did and does nothing.
    const calls = native.native.calls.length;
    assert.deepEqual(await host.timeline.host.activate({ prepared: again.prepared, expectedHead: head.headHash }), done);
    assert.equal(native.native.calls.length, calls);
    assert.equal(Object.keys(host.head().domains.savepoints.returns).length, 1);
});

test('participants that cannot switch leave the restore committed and the barrier up; a retry or recover completes it', async t => {
    const { host, native, saved, atSave } = await story(t);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    native.native.fail.add('activate');
    const pending = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.deepEqual(pending, { ok: true, return: prepared.return, status: 'participants-pending' });
    // The story is restored; everything else waits for the participant.
    assert.equal(host.registry.restore().state, 'pending');
    assert.equal(host.head().domains.progress.xp, 40, 'the story is restored (when every module is asked: after the barrier)');
    assert.deepEqual(host.sdk.modules().map(module => module.status), ['restore-pending', 'restore-pending', 'restore-pending', 'restore-pending']);
    assert.equal((await host.sdk.timeline.head()).code, 'RESTORE_PENDING');
    const waiting = await host.sdk.timeline.status();
    assert.equal(waiting.state, 'pending');
    assert.equal(waiting.return, prepared.return);
    assert.deepEqual(waiting.participants, saved.participants);
    assert.deepEqual(waiting.blockedBy, { module: NATIVE, code: 'FAILED' });
    assert.match(waiting.reason, /Test native.*activate failed.*tried again/);
    assert.equal((await host.sdk.command('tl.xp', { amount: 1 })).code, 'RESTORE_PENDING');
    assert.equal((await host.sdk.timeline.make({ kind: 'manual' })).code, 'RESTORE_PENDING');
    assert.equal((await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: ['ev_other0001'], batchResult: batchFor('br_batch009'), expectedHead: head.headHash })).code, 'RESTORE_PENDING');
    assert.equal(host.ctx.chat.at(-1).extra.storySuite.receipts.at(-1).type, 'savepoint.restore', 'not complete yet');
    assert.equal(host.timeline.host.journal().find(each => each.id === prepared.prepared).phase, 'participants-pending');
    // The participant is back: a retry finishes it, once.
    native.native.fail.clear();
    const done = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.deepEqual(done, { ok: true, return: prepared.return, status: 'complete' });
    assert.equal(host.registry.restore().state, 'idle');
    assert.deepEqual(slice(host.head()), atSave);
    assert.equal((await host.sdk.command('tl.xp', { amount: 1 })).ok, true, 'the story goes on');
    assert.equal(host.sdk.modules().every(module => module.status === 'ready'), true);
    assert.deepEqual(native.native.store.dossiers, { tavi: { trust: 3 } });
    assert.equal(host.head().domains.savepoints.returns[prepared.return].status, 'complete');
    assert.equal(native.native.calls.filter(call => call.name === 'activate' && !call.fail).length >= 2, true);
});

for (const failure of ['aborted', 'conflict', 'not-found']) {
    test(`a committed restore waits quietly on participant ${failure} until it recovers`, async t => {
        let failing = false;
        const { host, saved } = await story(t, { configure(module) {
            const status = module.def.participant.status;
            const activate = module.def.participant.activate;
            module.def.participant.status = input => {
                const answer = status(input);
                return failing && failure === 'aborted' && answer.ok ? { ...answer, status: 'aborted' } : answer;
            };
            module.def.participant.activate = input => failing && failure === 'conflict'
                ? { ok: false, code: 'CONFLICT', message: 'other checkpoint' }
                : failing && failure === 'not-found' ? { ok: false, code: 'NOT_FOUND', message: 'nothing prepared' } : activate(input);
        } });
        const head = await host.sdk.timeline.head();
        const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
        failing = true;
        assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).status, 'participants-pending');
        const status = await host.sdk.timeline.status();
        assert.equal(status.state, 'pending');
        assert.equal(status.blockedBy, null);
        assert.deepEqual(host.turn.problems(NATIVE), []);
        assert.deepEqual(host.st.notices, []);
        failing = false;
        assert.equal((await host.timeline.host.recover()).state, 'idle');
        assert.deepEqual(host.turn.problems(NATIVE), []);
    });
}

for (const code of ['SNAPSHOT_UNAVAILABLE', 'NOT_FOUND']) test(`a missing checkpoint (${code}) during a committed restore is reported and recovery preserves the journal`, async t => {
    let missing = false;
    const { host, native, saved } = await story(t, { configure(module) {
        const activate = module.def.participant.activate;
        module.def.participant.activate = input => missing ? { ok: false, code, message: 'checkpoint file returned 404' } : activate(input);
    } });
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    missing = true;
    assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).status, 'participants-pending');
    const status = await host.sdk.timeline.status();
    assert.deepEqual(status.blockedBy, { module: NATIVE, code });
    assert.match(status.reason, /404.*backup.*original chat/);
    assert.equal(host.turn.problems(NATIVE).at(-1).toast, true);
    const sent = await host.send('Please continue.', 'Not sent.');
    assert.equal(sent.aborted, true);
    assert.equal(host.ctx.chat.at(-1).mes, 'Please continue.');
    assert.match(host.st.notices.at(-1).reason, /404.*backup/);
    assert.equal(host.timeline.host.journal().find(each => each.id === prepared.prepared).phase, 'participants-pending');
    missing = false;
    assert.equal((await host.timeline.host.recover()).state, 'idle');
    assert.equal(native.native.active, saved.participants[0].checkpoint);
});

test('a committed restore with a hung status callback times out, warns once, and retries safely', { timeout: 3000 }, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let hang = false;
    let finish;
    const { host, saved } = await story(t, { configure(module) {
        const status = module.def.participant.status;
        module.def.participant.status = input => hang ? new Promise(resolve => { finish = () => resolve(status(input)); }) : status(input);
    } });
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    hang = true;
    const activation = host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    for (let i = 0; i < 40 && !finish; i += 1) await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof finish, 'function');
    const sent = await host.send('Keep my words.', 'Not sent.');
    assert.equal(sent.aborted, true);
    assert.equal(host.ctx.chat.at(-1).mes, 'Keep my words.');
    t.mock.timers.tick(PARTICIPANT_TIMEOUT_MS);
    for (let i = 0; i < 40; i += 1) await new Promise(resolve => setImmediate(resolve));
    assert.equal((await activation).status, 'participants-pending');
    let status = await host.sdk.timeline.status();
    assert.deepEqual(status.blockedBy, { module: NATIVE, code: 'STALE' });
    assert.match(status.reason, /did not answer status in time/);
    for (const ms of RETRY_SCHEDULE_MS) {
        t.mock.timers.tick(ms);
        for (let i = 0; i < 40; i += 1) await new Promise(resolve => setImmediate(resolve));
    }
    status = await host.sdk.timeline.status();
    assert.match(status.reason, /still could not load.*timed out.*Reload the page/);
    assert.equal(host.turn.problems(NATIVE).length, 1);
    assert.equal(host.turn.problems(NATIVE)[0].toast, true);
    hang = false;
    finish();
    for (let i = 0; i < 40; i += 1) await new Promise(resolve => setImmediate(resolve));
    assert.equal((await host.timeline.host.recover()).state, 'idle');
    assert.equal((await host.sdk.timeline.status()).state, 'idle');
});

test('recover finishes a restore whose participants were pending, and aborts a prepare nobody activated', async t => {
    const { host, native, saved } = await story(t);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    native.native.fail.add('activate');
    await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    native.native.fail.clear();
    assert.deepEqual(await host.timeline.host.recover(), { ok: true, state: 'idle', return: null });
    assert.equal(host.registry.restore().state, 'idle');
    assert.equal(host.head().domains.savepoints.returns[prepared.return].status, 'complete');
    assert.deepEqual(native.native.store.dossiers, { tavi: { trust: 3 } });
    // recover with nothing to do does nothing.
    const writes = host.ctx.chat.map(message => JSON.stringify(message.extra?.storySuite ?? null));
    assert.deepEqual(await host.timeline.host.recover(), { ok: true, state: 'idle', return: null });
    assert.deepEqual(host.ctx.chat.map(message => JSON.stringify(message.extra?.storySuite ?? null)), writes);
});

test('modules with guarded blocks in the story: the barrier turns them off while it is up, the restore and the return stand when it drops', async t => {
    const native = nativeModule();
    const host = await createHost({ modules: [rulesModule(), native.def] });
    t.after(() => host.close());
    await host.send('Go.', reply('A.', ['+ coin 10']));
    // A guarded block of another module before the save (its epoch: the timeline has none yet, so any will do) and one after it.
    await cmd(host, 'tl.guarded', { epoch: 'ep_00000000' });
    const saved = (await host.sdk.timeline.make({ kind: 'manual', name: 'After the guard' })).snapshot;
    const atSave = slice(host.head());
    await host.send('Go.', reply('B.', ['+ coin 5']));
    await cmd(host, 'tl.guarded', { epoch: 'ep_00000000' });
    assert.equal(host.head().domains.progress.xp, 2);
    await seal(host);
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    native.native.fail.add('activate');
    const pending = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(pending.status, 'participants-pending');
    assert.equal(host.registry.restore().state, 'pending');
    // With the barrier up, the module is held and its guarded blocks are not asked: the head is not whole, and nothing reads it.
    assert.equal((await host.sdk.timeline.head()).code, 'RESTORE_PENDING');
    // Recovery within the run goes by the journal, not by the head the barrier has made partial.
    native.native.fail.clear();
    assert.deepEqual(await host.timeline.host.recover(), { ok: true, state: 'idle', return: null });
    assert.equal(host.registry.restore().state, 'idle');
    assert.deepEqual(slice(host.head()), atSave, 'the guarded block before the save is back with the module');
    assert.equal(host.head().domains.progress.xp, 1);
    assert.equal(host.head().domains.savepoints.returns[prepared.return].status, 'complete');
    assert.deepEqual(host.store.problems(), []);
    host.store.rebuild();
    assert.deepEqual(slice(host.head()), atSave);
    assert.deepEqual(host.store.problems(), []);
});
