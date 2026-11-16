// Round two of the timeline (docs/v2/TIMELINE.md): the commit is in the chat file before anything is switched, commits that cannot
// race, and a host domain and participant identities no module can forge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { crash } from '../../core/timeline/index.js';
import { BATCH, DEATH, NATIVE, NPC, clone, nativeModule, reload } from './helpers/timeline.js';
import { hasReceipt, restoreFrom, world } from './timeline-hardening.helpers.js';

// ---- 1. the commit is durable before anything is switched --------------------------------------------------

test('a restore whose commit could not be saved switches no participant; the retry saves the commit first', async t => {
    const { host, native, disk, saved, prepared, activate } = await world(t);
    host.st.failSaves = 1;
    const failed = await activate();
    assert.equal(failed.ok, false);
    assert.equal(failed.code, 'FAILED');
    assert.match(failed.message, /could not be saved/);
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false, 'no participant was asked to switch');
    assert.equal(hasReceipt(disk.image, 'savepoint.restore'), false, 'the file does not have the commit');
    assert.equal(host.registry.restore().state, 'pending', 'the barrier stays up');
    assert.deepEqual(native.native.store.dossiers.tavi, { trust: 99 });
    // The retry saves the commit, and only then asks the participant.
    const done = await activate();
    assert.deepEqual(done, { ok: true, return: prepared.return, status: 'complete' });
    assert.equal(hasReceipt(disk.image, 'savepoint.restore'), true);
    assert.equal(hasReceipt(disk.image, 'savepoint.complete'), true);
    assert.equal(native.native.store.dossiers.tavi.trust, 3);
    void saved;
});

test('a crash after the participant switched cannot leave the story without the return: the commit was saved before the switch', async t => {
    const { host, native, hook, disk, modules, activate, prepared } = await world(t);
    host.st.failSaves = 1;
    assert.equal((await activate()).ok, false);
    hook.on = phase => { if (phase === 'activate.participant:tl-native:acked') throw crash(); };
    await assert.rejects(activate(), error => error.message.includes('simulated crash'));
    assert.equal(native.native.store.dossiers.tavi.trust, 3, 'the participant switched');
    const image = clone(disk.image);
    assert.equal(hasReceipt(image, 'savepoint.restore'), true, 'and the file has the restore it switched for');
    const again = await reload(createHost, image, modules());
    t.after(() => again.close());
    assert.equal(again.head().domains.progress.xp, 40, 'not xp 140 with a restored participant');
    assert.equal(again.head().domains.savepoints.returns[prepared.return].status, 'complete');
    assert.equal((await again.sdk.timeline.status()).state, 'idle');
    assert.equal(again.registry.restore().state, 'idle');
});

test('a restore is told complete only when the final save worked; a failed one is the caller\'s failure and a retry answers once it is saved', async t => {
    const { host, hook, disk, activate, prepared } = await world(t);
    hook.on = phase => { if (phase === 'activate.acked') host.st.failSaves = 1; };
    const failed = await activate();
    assert.equal(failed.ok, false, 'not told complete');
    assert.equal(hasReceipt(disk.image, 'savepoint.complete'), false);
    hook.on = null;
    assert.deepEqual(await activate(), { ok: true, return: prepared.return, status: 'complete' });
    assert.equal(hasReceipt(disk.image, 'savepoint.complete'), true, 'told complete after the file has it');
});

test('a save point and a forget are told made only when the chat is saved', async t => {
    const { host, hook } = await world(t, { prepare: false });
    // The bytes cannot be saved: nothing is stored.
    host.st.failSaves = 1;
    const early = await host.sdk.timeline.make({ kind: 'manual', name: 'Early' });
    assert.equal(early.code, 'FAILED');
    assert.equal(Object.values(host.head().domains.savepoints.points).some(point => point.name === 'Early'), false);
    // The descriptor is in the story but the file could not take it: the caller is told, and the store saves it when it can.
    hook.on = phase => { if (phase === 'make.committed') host.st.failSaves = 1; };
    const failed = await host.sdk.timeline.make({ kind: 'manual', name: 'Unsaved' });
    hook.on = null;
    assert.equal(failed.ok, false);
    assert.equal(failed.code, 'FAILED');
    assert.match(failed.message, /could not be saved yet/);
    const id = Object.values(host.head().domains.savepoints.points).find(point => point.name === 'Unsaved').id;
    host.st.failSaves = 1;
    const forgotten = await host.sdk.timeline.forget({ snapshot: id });
    assert.equal(forgotten.ok, false);
    assert.equal((await host.sdk.timeline.forget({ snapshot: id })).code, 'NOT_FOUND', 'it is forgotten in the story');
});

// ---- 2. commits that cannot race -----------------------------------------------------------------------------

test('an activate whose head moves while it waits is STALE, not restored', async t => {
    const { host, native, hook, activate, prepared } = await world(t);
    hook.on = async phase => { if (phase === 'activate.checked') await host.sdk.command('tl.xp', { amount: 1 }); };
    const result = await activate();
    assert.equal(result.code, 'STALE');
    assert.equal(host.head().domains.progress.xp, 141);
    assert.equal(host.head().domains.savepoints.returns && Object.keys(host.head().domains.savepoints.returns).length, 0);
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false);
    assert.equal(host.timeline.host.journal().find(entry => entry.id === prepared.prepared).phase, 'aborted');
    assert.equal(host.registry.restore().state, 'idle');
});

test('an activate for a chat that was swapped while it waited is STALE and writes nothing to the other chat', async t => {
    const { host, native, hook, activate } = await world(t);
    const original = host.ctx.chatMetadata;
    hook.on = phase => { if (phase === 'activate.checked') host.ctx.chatMetadata = { storySuite: {} }; };
    const result = await activate();
    host.ctx.chatMetadata = original;
    assert.equal(result.code, 'STALE');
    assert.equal(host.head().domains.progress.xp, 140);
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false);
    assert.deepEqual(host.ctx.chatMetadata.storySuite.timeline.journal[Object.keys(host.ctx.chatMetadata.storySuite.timeline.journal).find(id => id.startsWith('pp_'))].phase, 'prepared');
});

test('two activates of one token at once: one restore, the second answers the first', async t => {
    const { native, activate, prepared } = await world(t);
    const [a, b] = await Promise.all([activate(), activate()]);
    assert.deepEqual(a, { ok: true, return: prepared.return, status: 'complete' });
    assert.deepEqual(b, a);
    assert.equal(native.native.calls.filter(call => call.name === 'activate').length, 1);
});

test('a native event whose head moves while the participant makes its checkpoint is STALE and is not delivered', async t => {
    const native = nativeModule();
    let moves = false;
    const inner = native.def.participant.checkpoint;
    native.def.participant.checkpoint = async input => {
        if (moves) await host.sdk.command('tl.xp', { amount: 1 });
        return inner(input);
    };
    const { host } = await world(t, { native, prepare: false });
    moves = true;
    const head = await host.sdk.timeline.head();
    const result = await host.timeline.host.nativeEvent({ event: 'ev_race0001', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash });
    assert.equal(result.code, 'STALE');
    assert.equal(native.native.calls.some(call => call.name === 'applyEvent'), false);
    assert.equal(host.timeline.host.journal().some(entry => entry.kind === 'native-event'), false);
    assert.equal(host.registry.restore().state, 'idle');
});

// ---- 3. forgeable host state and participant identity ------------------------------------------------------

test('no module can declare the host\'s savepoints domain', async t => {
    const { host } = await world(t, { prepare: false });
    const evil = { id: 'evil', name: 'Evil', version: '1.0.0', domains: { savepoints: { initial: () => ({ epoch: 'ep_aaaaaaaa', points: {} }) } } };
    await assert.rejects(host.sdk.registerModule(evil), /savepoints.*host's own/);
    await assert.rejects(createHost({ modules: [evil] }), /savepoints.*host's own/);
    assert.equal(host.registry.has('evil'), false);
});

test('only the host\'s own blocks write the savepoints: not a command\'s changes, not a block of another module, live or on replay', async t => {
    const { host } = await world(t, { prepare: false });
    const rev = host.head().meta.rev + 1;
    const receipt = { id: 'rc_forged001', type: 'x.forge', module: 'rival', cause: 'system', seed: 1, summary: 'x', narrate: false, data: {}, rev };
    const ops = [{ op: 'add', path: '/domains/savepoints/returns/rt_forged01', value: { id: 'rt_forged01' } }, { op: 'replace', path: '/meta/rev', value: rev }];
    assert.throws(() => host.store.append({ ops, receipt }), /host's own/);
    const block = { module: 'rival', source: host.store.sourceAt(host.store.headIndex()), guard: null, operation: { type: 'savepoint.make', payload: {} }, recorded: null, result: {} };
    assert.throws(() => host.store.append({ ops, receipt, block }), /host's own/);
    assert.equal(host.head().domains.savepoints.returns.rt_forged01, undefined);
    // A hand-edited chat: the host's make block made out to be another module's, or a block with no metadata at all.
    const record = host.ctx.chat.at(-1).extra.storySuite;
    const span = record.spans.find(each => each.operation?.type === 'savepoint.make');
    const saved = clone(span);
    span.module = 'rival';
    host.store.rebuild();
    assert.equal(host.head().domains.savepoints, undefined, 'the block is off');
    assert.equal(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE' && /host's savepoints/.test(problem.why)), true);
    Object.assign(span, saved);
    host.store.rebuild();
    assert.equal(Object.keys(host.head().domains.savepoints.points).length, 1);
    const index = record.spans.indexOf(span);
    record.spans[index] = { n: span.n, story: false };
    for (const each of record.receipts) delete each.guarded;
    host.store.rebuild();
    assert.equal(host.head().domains.savepoints, undefined, 'a block with no metadata cannot write them');
    assert.equal(host.store.problems().some(problem => /host's savepoints/.test(problem.why)), true);
});

test('a participant\'s identity is the registering module\'s: a declaration naming another module is refused and fails closed', async t => {
    const { host, native, saved } = await world(t, { prepare: false });
    const other = nativeModule({ id: 'tl-other' });
    other.def.domains = {};
    other.def.participant.module = NATIVE;      // names the module that is registered already
    await host.sdk.registerModule(other.def);
    assert.deepEqual(host.timeline.host.participants(), [NATIVE], 'the real participant is untouched');
    const made = await host.sdk.timeline.make({ kind: 'manual', name: 'Not now' });
    assert.equal(made.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(made.message, /tl-other.*names another module/);
    assert.equal((await restoreFrom(host, saved)).code, 'SNAPSHOT_UNAVAILABLE');
    void native;
});

test('a field of a declaration cannot override the module: module is stamped from the definition', async t => {
    const { host } = await world(t, { prepare: false });
    const mine = nativeModule({ id: 'tl-mine' });
    mine.def.domains = {};
    await host.sdk.registerModule(mine.def);
    assert.equal(host.timeline.host.participants().includes('tl-mine'), true);
    assert.equal(host.timeline.host.participants().includes('someone-else'), false);
});

test('a death is taken only by the participant that owns npc.identity', async t => {
    const { host } = await world(t, { prepare: false });
    const other = nativeModule({ id: 'tl-other' });
    other.def.domains = {};
    await host.sdk.registerModule(other.def);
    const head = await host.sdk.timeline.head();
    const result = await host.timeline.host.nativeEvent({ event: 'ev_owner001', participant: 'tl-other', kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash });
    assert.equal(result.code, 'REFUSED');
    assert.match(result.message, /does not own npc\.identity/);
    assert.equal(other.native.calls.some(call => call.name === 'applyEvent'), false);
    const mine = await host.timeline.host.nativeEvent({ event: 'ev_owner002', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash });
    assert.equal(mine.ok, true, mine.message);
});
