// The restore protocol (docs/v2/TIMELINE.md, contract §8): absolute restore, epochs, claims and proofs,
// rebuild/reload, forged/unauthorized tokens, prepare validation and manifest, and host commit blocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { hashJson } from '../../core/replay.js';
import { director } from '../../packages/story-block/tests/v2/helpers/evidence.js';
import { BATCH, DEATH, NATIVE, batchFor, clone, nativeModule, restore, rulesModule, slice } from '../../packages/story-block/tests/v2/helpers/timeline.js';
import { cmd, story } from './timeline-restore.helpers.js';

test('absolute restore: time, wallet, pools, XP, gear, combat, training and npc go back to the save, whatever came after', async t => {
    const { host, native, saved, atSave } = await story(t);
    const dead = slice(host.head());
    assert.notDeepEqual(dead, atSave, 'the story really moved');
    const revBefore = host.head().meta.rev;
    const { prepared, activated } = await restore(host, saved.id);
    assert.equal(prepared.ok, true, prepared.message);
    assert.deepEqual(activated, { ok: true, return: prepared.return, status: 'complete' });
    const now = host.head();
    // Each captured slice, one by one, so a failure says which.
    for (const name of ['director', 'party', 'progress', 'gear', 'combat', 'training', 'npc', 'rules', 'inventory', 'scene', 'sdt', 'nat']) {
        assert.deepEqual(clone(now.domains[name]), atSave.domains[name], `${name} is as it was saved`);
    }
    assert.equal(now.domains.director.time.minutes, 600);
    assert.equal(now.domains.inventory.wallets.party.coin, 30, 'the wallet');
    assert.deepEqual(now.domains.party.pools, { hp: 16, mp: 5, sp: 10 }, 'the pools');
    assert.equal(now.domains.progress.xp, 40, 'XP');
    assert.deepEqual(now.domains.gear.equipped, { hand: 'Sword' }, 'gear');
    assert.deepEqual(now.domains.combat.fight, { id: 'fi_first001', round: 1 }, 'combat');
    assert.deepEqual(now.domains.training, { session: { id: 'tr_one00001', minutes: 60 }, paid: 10 }, 'training: the running session, paid once');
    assert.deepEqual(now.domains.npc.meters, { tavi: 3 }, 'npc');
    assert.deepEqual(slice(now), atSave, 'and nothing else of the story is left over');
    // The host's counters go on: the revision is never restored.
    assert.equal(now.meta.rev > revBefore, true);
    // The native participant is on the saved checkpoint with its dossiers.
    assert.deepEqual(native.native.store, { dossiers: { tavi: { trust: 3 } }, applied: [] });
    assert.equal(native.native.active, saved.participants[0].checkpoint);
    // A rebuild from the chat agrees with what the store holds.
    host.store.rebuild();
    assert.deepEqual(clone(host.head()), clone(now));
    assert.deepEqual(host.store.problems(), []);
});

test('the restore installs the savepoints in a new epoch: earlier points stay, later ones go, the return is recorded', async t => {
    const { host, saved } = await story(t);
    const early = (await host.timeline.host.make({ kind: 'initial' })).snapshot;
    // (made after the save in time, so it is on the dead timeline only)
    const before = host.head().domains.savepoints;
    assert.equal(Object.keys(before.points).length, 2);
    const { prepared } = await restore(host, saved.id);
    const domain = host.head().domains.savepoints;
    assert.notEqual(domain.epoch, 'ep_00000000');
    assert.match(domain.epoch, /^ep_[0-9a-z]{8}$/);
    assert.deepEqual(Object.keys(domain.points), [saved.id], 'the save it restored to stays; the one made after it is faded away');
    assert.equal(domain.points[early.id], undefined);
    assert.deepEqual(domain.points[saved.id], saved, 'the descriptor is the archived one');
    const record = domain.returns[prepared.return];
    assert.equal(record.status, 'complete');
    assert.deepEqual(record.deathEvents, DEATH);
    assert.deepEqual(record.batchResult, BATCH);
    assert.equal(record.snapshot, saved.id);
    assert.deepEqual(record.target, saved.target);
    assert.equal(record.oldEpoch, 'ep_00000000');
    assert.equal(record.newEpoch, domain.epoch);
    assert.deepEqual(record.faded, { after: saved.target, through: record.restoreAt }, 'the faded interval is (target, restore]');
    assert.equal(record.memory, 'deja-vu');
    assert.match(record.cue, /^cu_[0-9a-z]{8}$/);
    // The restore block starts where the head was, and the receipt says what happened.
    const carrier = host.ctx.chat.at(-1).extra.storySuite;
    const receipt = carrier.receipts.find(each => each.type === 'savepoint.restore');
    assert.equal(receipt.cause, 'system');
    assert.deepEqual(receipt.data.v2.result, { return: prepared.return, status: 'committed' });
    const span = carrier.spans.find(each => each.id === record.restoreAt.block);
    assert.deepEqual(span.boundaries[0].cursor, record.restoreAt);
    assert.equal(span.operation.type, 'savepoint.restore');
    assert.deepEqual(span.operation.payload, { snapshot: saved.id, deathEvent: DEATH[0], prepared: prepared.prepared });
    assert.equal(span.guard.owner, 'story-block');
    assert.equal(carrier.receipts.at(-1).type, 'savepoint.complete');
    // A second death can use the same save: it is still eligible, in the new epoch.
    await cmd(host, 'tl.xp', { amount: 7 });
    const again = await restore(host, saved.id, { batch: batchFor('br_batch002'), events: ['ev_death002'] });
    assert.equal(again.activated.status, 'complete', again.prepared.message);
    const twice = host.head().domains.savepoints;
    assert.equal(Object.keys(twice.returns).length, 2, 'both returns are kept: the audit');
    assert.notEqual(twice.epoch, domain.epoch);
    assert.equal(host.head().domains.progress.xp, 40);
    assert.deepEqual(host.store.problems(), []);
});

test('story claims go back to the saved set and the proof of the faded story is no longer active', async t => {
    const { host, saved, proofsAtSave } = await story(t);
    assert.deepEqual(Object.keys(host.head().meta.claims).sort().filter(key => ['early', 'late'].includes(key)), ['early', 'late']);
    const shown = host.sdk.query('story.evidence', {}).map(proof => proof.id);
    assert.equal(shown.length, proofsAtSave.length + 1, 'the late acceptance is active on the dead timeline');
    await restore(host, saved.id);
    const meta = host.head().meta;
    assert.equal(Object.hasOwn(meta.claims, 'early'), true);
    assert.equal(Object.hasOwn(meta.claims, 'late'), false);
    assert.deepEqual(host.sdk.query('story.evidence', {}).map(proof => proof.id), proofsAtSave, 'the proof the dead timeline gave is not active; the earlier proof is');
    assert.equal(Object.keys(meta.proofs).length, proofsAtSave.length);
    // The claim may be taken again on the restored timeline.
    assert.equal((await host.sdk.command('tl.claim', { key: 'late' })).ok, true);
});

test('a restore is the same after a rebuild and after a reload from the chat file', async t => {
    const { host, saved } = await story(t);
    await restore(host, saved.id);
    await cmd(host, 'tl.xp', { amount: 1 });
    const live = clone(host.head());
    host.store.rebuild();
    assert.deepEqual(clone(host.head()), live);
    const fresh = await createHost({ modules: [rulesModule(), nativeModule().def, director()], st: { chat: clone(host.ctx.chat) } });
    t.after(() => fresh.close());
    assert.deepEqual(clone(fresh.head()), live, 'a new store over a copy of the chat');
    assert.deepEqual(fresh.store.problems(), []);
});

test('an unauthorized or forged token is refused: no capability, a copy of it, a command, an asserted token', async t => {
    const { host, saved } = await story(t);
    const rival = { id: 'rival', name: 'Rival', version: '1.0.0', commands: { 'rival.restore'(ctx, payload) { return ctx.call('savepoint.restore', payload); } } };
    await host.sdk.registerModule(rival);
    const head = await host.sdk.timeline.head();
    const input = { snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash };
    const before = clone(host.head());
    const real = host.timeline.capability;
    const forgeries = [undefined, null, {}, { capability: {} }, { capability: null }, { ...real }, { capability: { ...real } }, Object.freeze({ timeline: 'story-block' }), 'story-block', true, { capability: real.timeline }];
    for (const forged of forgeries) {
        for (const [method, args] of [['prepare', input], ['activate', { prepared: 'pp_forged001', expectedHead: head.headHash }], ['abort', { prepared: 'pp_forged001' }], ['nativeEvent', {}], ['registerParticipant', {}]]) {
            const result = await host.sdk.timeline[method](args, forged);
            assert.equal(result.ok, false, `${method} with ${JSON.stringify(forged)}`);
            assert.equal(result.code, 'REFUSED', `${method} with ${JSON.stringify(forged)}`);
        }
        assert.equal((await host.sdk.timeline.recover({}, forged)).code, 'REFUSED');
    }
    assert.equal((await host.sdk.timeline.nativeMutation({})).code, 'REFUSED', 'only the participant\'s own handle makes a native mutation');
    assert.equal((await host.timeline.host.recover.call(null)).ok, true);
    assert.equal((await host.sdk.timeline.recover({ surprise: 1 }, host.timeline.capability)).code, 'INVALID', 'recover takes {}');
    // The public methods that need no authority do not carry any: a make of another kind is refused.
    assert.equal((await host.sdk.timeline.make({ kind: 'initial' }, { capability: {} })).code, 'REFUSED');
    // savepoint.restore is no command: not from the page (internal), not from any cause, not from a module.
    for (const cause of ['ui', 'story', 'system']) {
        const result = host.bus.command('savepoint.restore', { snapshot: saved.id, deathEvent: DEATH[0], prepared: 'pp_forged001' }, { cause });
        assert.equal(result.code, 'REFUSED', cause);
    }
    assert.equal((await host.sdk.command('savepoint.restore', { snapshot: saved.id, deathEvent: DEATH[0], prepared: 'pp_forged001' })).code, 'REFUSED');
    assert.equal(host.bus.command('rival.restore', { snapshot: saved.id, deathEvent: DEATH[0], prepared: 'pp_forged001' }, { cause: 'system' }).code, 'REFUSED');
    // A token read out of the archive is no better: the real prepared token, asked for without the capability.
    const prepared = await host.timeline.host.prepare(input);
    assert.equal(prepared.ok, true, prepared.message);
    assert.equal((await host.sdk.timeline.activate({ prepared: prepared.prepared, expectedHead: head.headHash })).code, 'REFUSED');
    assert.equal((await host.sdk.timeline.activate({ prepared: prepared.prepared, expectedHead: head.headHash }, { capability: { ...real } })).code, 'REFUSED');
    assert.equal(host.bus.command('savepoint.restore', { snapshot: saved.id, deathEvent: DEATH[0], prepared: prepared.prepared }, { cause: 'system' }).code, 'REFUSED');
    assert.equal(host.ctx.chatMetadata.storySuite.timeline.journal[prepared.prepared].phase, 'prepared', 'none of it touched the prepared restore');
    // An unknown token with the real capability is NOT_FOUND; a malformed one is INVALID.
    assert.equal((await host.timeline.host.activate({ prepared: 'pp_unknown01', expectedHead: head.headHash })).code, 'NOT_FOUND');
    assert.equal((await host.timeline.host.activate({ prepared: 3, expectedHead: head.headHash })).code, 'INVALID');
    assert.equal((await host.timeline.host.activate({ prepared: prepared.prepared })).code, 'INVALID');
    assert.equal((await host.timeline.host.abort({ prepared: 'pp_unknown01' })).code, 'NOT_FOUND');
    assert.deepEqual(clone(host.head()), before, 'the story did not move');
    // A save point cannot be read as a token either: the journal entry of a make is no restore.
    const makeEntry = host.timeline.host.journal().find(entry => entry.kind === 'make');
    assert.equal((await host.timeline.host.activate({ prepared: makeEntry.id, expectedHead: head.headHash })).code, 'NOT_FOUND');
});

test('prepare: shape, then the head (STALE), the point (NOT_FOUND), the batch (CONFLICT); an identical retry returns the original', async t => {
    const { host, saved } = await story(t);
    const head = await host.sdk.timeline.head();
    const good = { snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash };
    const bad = async patch => (await host.timeline.host.prepare({ ...good, ...patch })).code;
    assert.equal(await bad({ snapshot: undefined }), 'INVALID');
    assert.equal(await bad({ deathEvents: [] }), 'INVALID');
    assert.equal(await bad({ deathEvents: ['a', 'a'] }), 'INVALID');
    assert.equal(await bad({ batchResult: { id: 'nope', hash: BATCH.hash } }), 'INVALID');
    assert.equal(await bad({ batchResult: { id: BATCH.id } }), 'INVALID');
    assert.equal(await bad({ expectedHead: 'abc' }), 'INVALID');
    assert.equal(await bad({ surprise: true }), 'INVALID');
    assert.equal(await bad({ snapshot: 'sn_nothing0' }), 'NOT_FOUND');
    assert.equal(await bad({ expectedHead: 'f'.repeat(64) }), 'STALE');
    const first = await host.timeline.host.prepare(good);
    assert.equal(first.ok, true, first.message);
    assert.match(first.prepared, /^pp_[0-9a-z]{8}$/);
    assert.match(first.return, /^rt_[0-9a-z]{8}$/);
    assert.match(first.manifestHash, /^[0-9a-f]{64}$/);
    assert.deepEqual(await host.timeline.host.prepare(good), first, 'the same prepare again is the same answer');
    assert.equal(await bad({ batchResult: { id: BATCH.id, hash: 'd'.repeat(64) } }), 'CONFLICT', 'the same batch with another hash');
    assert.equal(await bad({ snapshot: saved.id, deathEvents: ['ev_other0001'] }), 'CONFLICT', 'the same batch with other deaths');
    // Preparing changed nothing the reader sees, and the head is the same.
    assert.equal((await host.sdk.timeline.head()).headHash, head.headHash);
    assert.deepEqual(host.sdk.query('savepoint.list', {}).map(point => point.id), [saved.id]);
});

test('prepare writes the durable record: the manifest, the pinned batch result and the story as it was', async t => {
    const { host, native, saved } = await story(t);
    const dead = slice(host.head());
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    const entry = host.timeline.host.journal().find(each => each.id === prepared.prepared);
    assert.equal(entry.phase, 'prepared');
    assert.equal(entry.manifestHash, prepared.manifestHash);
    assert.equal(hashJson(entry.manifest), prepared.manifestHash);
    assert.equal(entry.manifest.snapshot, saved.id);
    assert.equal(entry.manifest.payloadHash, saved.payloadHash);
    assert.deepEqual(entry.manifest.participants, saved.participants);
    assert.deepEqual(Object.keys(entry.manifest.domains).sort(), Object.keys(host.head().domains).sort(), 'every domain is listed');
    assert.equal(entry.manifest.domains.party.source, 'saved');
    assert.equal(entry.manifest.domains.savepoints.source, 'host');
    assert.equal(entry.participants[NATIVE].prepared !== null, true);
    assert.equal(native.native.calls.some(call => call.name === 'prepare'), true);
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false, 'nothing is switched yet');
    assert.deepEqual(native.native.store.dossiers.tavi, { trust: 99 }, 'the reader still sees the dead timeline');
    assert.deepEqual(slice(host.head()), dead);
    // The pin: the batch result, the prepared manifest, and the story the restore will replace.
    const pin = host.timeline.host.pin(BATCH.id);
    assert.equal(pin.hash, BATCH.hash);
    assert.equal(pin.return, prepared.return);
    assert.equal(pin.prepared, prepared.prepared);
    assert.equal(pin.manifestHash, prepared.manifestHash);
    assert.deepEqual(pin.deathEvents, DEATH);
    assert.equal(pin.preRestore.payload.domains.progress.xp, 140, 'the death domain as it stood when the batch was sealed');
    await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(host.head().domains.progress.xp, 40);
    const kept = host.timeline.host.pin(BATCH.id);
    assert.equal(kept.preRestore.payload.domains.progress.xp, 140, 'after the restore the original result is still retrievable');
    assert.equal(kept.preRestore.payload.domains.npc.meters.tavi, 8);
    assert.equal(host.timeline.host.pin('br_nothing01'), null);
});

test('the host\'s blocks are told like any commit: the restore, the completion, a forgotten point', async t => {
    const { host, saved } = await story(t);
    const told = [];
    host.sdk.on('committed', ({ receipt }) => told.push(receipt.type));
    const other = (await host.sdk.timeline.make({ kind: 'manual', name: 'Another' })).snapshot;
    assert.equal((await host.sdk.timeline.forget({ snapshot: other.id })).ok, true);
    assert.equal((await restore(host, saved.id)).activated.status, 'complete');
    assert.deepEqual(told, ['savepoint.make', 'savepoint.forget', 'savepoint.restore', 'savepoint.complete']);
});
