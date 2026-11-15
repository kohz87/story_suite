// The timeline's rules as principles (docs/v2/TIMELINE.md): durability, chat-bound operations, reserved savepoints, participants at commit, registration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { crash } from '../../src/v2/timeline/index.js';
import { definitionWarnings } from '../../src/v2/registry.js';
import { BATCH, DEATH, NATIVE, NPC, clone, nativeModule, reload } from './helpers/timeline.js';
import { SCENARIOS, journalOf, reply, world } from './timeline-principles.helpers.js';

// ---- 1. durability, at every write position ------------------------------------------------------------------------------

for (const [name, scenario] of Object.entries(SCENARIOS)) {
    test(`${name}: a save that fails at any of its write positions is never told as done, announces nothing the file lacks, and the journal leads the participant`, async t => {
        // How many flushes it makes when nothing fails.
        const dry = await world(t, { scenario: name });
        const clean = await scenario.run(dry);
        assert.equal(clean.ok, true, clean.message);
        assert.equal(scenario.done(dry), true, 'told done, and the file has it');
        assert.deepEqual(dry.breaches, []);
        const total = dry.counter.n;
        assert.equal(total >= 2, true, `${name} writes at several positions (${total})`);
        for (let at = 1; at <= total; at++) {
            const w = await world(t, { failing: at, scenario: name });
            const result = await scenario.run(w);
            assert.equal(w.counter.failed, true, `flush ${at} was reached`);
            if (result.ok) assert.equal(scenario.done(w), true, `flush ${at} failed, and the operation said ok but the file does not have it`);
            assert.deepEqual(w.breaches, [], `flush ${at}: a participant changed ahead of its journal`);
            for (const each of w.told) assert.equal(each.onDisk, true, `flush ${at}: ${each.type} was announced before the file had it`);
            // Nothing is left that a restart or a retry cannot finish: with the disk back, recovery settles it.
            const again = await w.host.timeline.recover();
            assert.equal(again.ok, true, `flush ${at}: ${again.message}`);
            assert.equal((await w.host.sdk.timeline.status()).state, 'idle', `flush ${at}`);
            assert.equal(w.host.registry.restore().state, 'idle', `flush ${at}`);
            for (const each of w.told) assert.equal(each.onDisk, true, `flush ${at}: ${each.type} was announced before the file had it`);
        }
    });
}

test('a native event whose journal could not be saved: the retry saves the journal before the participant changes, so a crash inside applyEvent leaves it behind', async t => {
    let crashing = false;
    const w = await world(t, { failing: 1, wrap: native => {
        const real = native.def.participant.applyEvent;
        native.def.participant.applyEvent = args => { const answer = real(args); if (crashing) throw crash(); return answer; };
    } });
    const { host, native, hook, disk } = w;
    const head = await host.sdk.timeline.head();
    const input = { event: 'ev_crash0001', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash };
    const first = await host.timeline.host.nativeEvent(input);
    assert.equal(first.ok, false);
    assert.equal(first.code, 'FAILED');
    assert.equal(native.native.calls.some(call => call.name === 'applyEvent'), false);
    crashing = true;
    void hook;
    await assert.rejects(host.timeline.host.nativeEvent(input), error => error.message.includes('simulated crash'));
    assert.equal(native.native.store.applied.includes('ev_crash0001'), true, 'the participant changed');
    assert.equal(journalOf(disk).some(entry => entry.kind === 'native-event' && entry.event === 'ev_crash0001'), true, 'and the file has the journal of it');
    crashing = false;
    const again = await reload(createHost, clone(disk.image), w.modules());
    t.after(() => again.close());
    assert.equal(again.registry.restore().state, 'idle');
    assert.equal((await again.sdk.timeline.status()).state, 'idle');
    assert.equal(again.timeline.host.journal().find(entry => entry.kind === 'native-event').phase, 'done');
});

test('the last save of a native change failing is a failure, not a success, and the same event is not acknowledged until the file has it', async t => {
    const dry = await world(t);
    const probe = SCENARIOS['a native event'];
    assert.equal((await probe.run(dry)).ok, true);
    const w = await world(t, { failing: dry.counter.n });
    const result = await probe.run(w);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'FAILED');
    assert.equal(w.native.native.store.applied.includes('ev_sweep0001'), true, 'the participant did change');
    w.counter.failing = 0;
    // The barrier comes down only once the file has the change (E6b): until then the head cannot be read, and the recovery finishes it.
    assert.equal((await w.host.sdk.timeline.head()).code, 'RESTORE_PENDING');
    assert.equal((await w.host.timeline.recover()).ok, true);
    assert.equal(w.host.registry.restore().state, 'idle');
    const retried = await w.host.timeline.host.nativeEvent({ event: 'ev_sweep0001', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: (await w.host.sdk.timeline.head()).headHash });
    assert.equal(retried.ok, true, retried.message);
    assert.equal(probe.done(w), true, 'acknowledged once saved');
});

test('savepoint.complete is announced after the file has it, and not at all while the save fails', async t => {
    const dry = await world(t);
    assert.equal((await SCENARIOS['a restore'].run(dry)).ok, true);
    const w = await world(t, { failing: dry.counter.n });
    const result = await SCENARIOS['a restore'].run(w);
    assert.equal(result.ok, false);
    assert.equal(w.told.some(each => each.type === 'savepoint.complete'), false, 'not announced');
    w.counter.failing = 0;
    const done = await w.host.timeline.recover();
    assert.equal(done.ok, true);
    const completes = w.told.filter(each => each.type === 'savepoint.complete');
    assert.deepEqual(completes.map(each => each.onDisk), [true]);
});

// ---- 2. an operation is bound to the chat it began in -------------------------------------------------------------------------

const MAKE_PHASES = ['make.reserved', 'make.checkpoint:tl-native', 'make.checkpointed', 'make.archived', 'make.committed'];
const RESTORE_PHASES = [
    'prepare.journaled', 'prepare.participant:tl-native', 'activate.checked', 'activate.committed',
    'activate.participant:tl-native:before', 'activate.participant:tl-native:acked', 'activate.acked',
];
const NATIVE_PHASES = ['native.prepared', 'native.journaled'];

async function switching(t, phase, scenario) {
    const w = await world(t);
    const original = w.host.ctx.chatMetadata;
    const other = { storySuite: {} };
    w.hook.on = at => { if (at === phase) w.host.ctx.chatMetadata = other; };
    const result = await SCENARIOS[scenario].run(w);
    w.host.ctx.chatMetadata = original;
    return { w, result, other };
}

for (const [scenario, phases] of [['a save point', MAKE_PHASES], ['a restore', RESTORE_PHASES], ['a native mutation', NATIVE_PHASES]]) {
    for (const phase of phases) {
        test(`another chat opened at ${phase}: ${scenario} answers STALE and writes nothing to the chat that is open`, async t => {
            const { result, other } = await switching(t, phase, scenario);
            assert.equal(result.ok, false, 'the work of the chat that was left is not told as done');
            assert.equal(result.code, 'STALE', result.message);
            assert.deepEqual(other, { storySuite: {} }, 'the chat that was opened has no archive, no journal, nothing');
        });
    }
}

test('another chat opened at make.archived: no archive is made in it and the left chat keeps an unsettled entry for its own recovery', async t => {
    const { w, result, other } = await switching(t, 'make.archived', 'a save point');
    assert.equal(result.code, 'STALE');
    assert.equal(other.storySuite.timeline, undefined);
    assert.equal(journalOf({ image: { metadata: w.host.ctx.chatMetadata } }).some(entry => entry.kind === 'make' && entry.phase === 'archived'), true);
    assert.equal(w.host.registry.restore().state, 'idle', 'no barrier is left up for the chat that is open');
    // The left chat's own recovery settles it when it is opened again.
    assert.equal((await w.host.timeline.recover()).ok, true);
    assert.equal(journalOf({ image: { metadata: w.host.ctx.chatMetadata } }).some(entry => entry.kind === 'make' && entry.phase === 'archived'), false);
});

// ---- 3. the host's savepoints are reserved as a branch ----------------------------------------------------------------------

const RESERVED = ['', '/domains', '/domains/savepoints', '/domains/savepoints/epoch', '/domains/savepoints/returns/rt_forged01'];

test('a block that is not the host\'s cannot write the savepoints, nor anything that holds them, whatever the op or which end of it names the path', async t => {
    const w = await world(t);
    const { host } = w;
    const rev = host.head().meta.rev + 1;
    const receipt = { id: 'rc_forged001', type: 'x.forge', module: 'rival', cause: 'system', seed: 1, summary: 'x', narrate: false, data: {}, rev };
    const forged = { savepoints: { schema: 2, epoch: 'ep_forged01', points: {}, dayStarts: {}, previousDay: null, returns: { rt_forged01: { id: 'rt_forged01' } }, ruleSettings: {} } };
    const make = (op, path) => ({ op, path, ...(op === 'move' || op === 'copy' ? { from: path } : { value: path === '' ? { domains: forged } : path === '/domains' ? forged : 1 }) });
    const epoch = host.head().domains.savepoints.epoch;
    const attempts = [];
    for (const path of RESERVED) for (const op of ['add', 'replace', 'remove', 'move', 'copy']) attempts.push(make(op, path));
    // (a move or a copy whose far end is elsewhere and whose near end is reserved, and the other way)
    for (const op of ['move', 'copy']) for (const path of RESERVED) {
        attempts.push({ op, from: path, path: '/domains/elsewhere' });
        attempts.push({ op, from: '/domains/elsewhere', path });
    }
    for (const op of attempts) {
        assert.throws(() => host.store.append({ ops: [op, { op: 'replace', path: '/meta/rev', value: rev }], receipt }), /host's own/, JSON.stringify(op));
        const block = { module: 'rival', source: host.store.sourceAt(host.store.headIndex()), guard: null, operation: { type: 'savepoint.make', payload: {} }, recorded: null, result: {} };
        assert.throws(() => host.store.append({ ops: [op, { op: 'replace', path: '/meta/rev', value: rev }], receipt, block }), /host's own/, JSON.stringify(op));
    }
    assert.equal(host.head().domains.savepoints.epoch, epoch, 'the epoch is the one it was');
    assert.equal(Object.keys(host.head().domains.savepoints.returns ?? {}).includes('rt_forged01'), false);
    // An ordinary domain is still an ordinary write.
    assert.doesNotThrow(() => host.store.append({ ops: [{ op: 'add', path: '/domains/elsewhere', value: { x: 1 } }, { op: 'replace', path: '/meta/rev', value: rev }], receipt }));
});

test('forged savepoints in a stored record do not survive a rebuild: the block is off with a Problem, whichever way it writes them', async t => {
    for (const path of RESERVED.filter(each => each !== '' && each !== '/domains/savepoints/epoch')) {
        const w = await world(t);
        const { host } = w;
        await host.send('More.', reply('B.'));
        const before = clone(host.head().domains.savepoints);
        const record = host.ctx.chat.at(-1).extra.storySuite;
        const value = path === '/domains' ? { savepoints: { ...before, epoch: 'ep_forged01', returns: { rt_forged01: { id: 'rt_forged01', status: 'complete' } } } } : { id: 'rt_forged01' };
        record.ops.push({ op: path === '/domains/savepoints' ? 'replace' : 'add', path, value: path === '/domains/savepoints' ? { ...before, epoch: 'ep_forged01' } : value });
        host.store.rebuild();
        assert.equal(host.head().domains.savepoints.epoch, before.epoch, `${path}: the forged epoch is not there`);
        assert.equal(JSON.stringify(host.head().domains.savepoints).includes('rt_forged01'), false, `${path}: nor the forged return`);
        assert.equal(host.store.problems().some(problem => /host's savepoints/.test(problem.why)), true, `${path}: and it is reported`);
    }
});

test('the root and /domains in a stored record are the same: a legacy block that replaces them is reported and not applied', async t => {
    const w = await world(t);
    const { host } = w;
    await host.send('More.', reply('B.'));
    const before = clone(host.head().domains.savepoints);
    for (const op of [{ op: 'replace', path: '', value: { domains: { savepoints: { epoch: 'ep_forged01' } }, meta: { rev: 99 } } }, { op: 'remove', path: '/domains' }]) {
        const record = host.ctx.chat.at(-1).extra.storySuite;
        const saved = clone(record.ops);
        record.ops.push(op);
        host.store.rebuild();
        assert.deepEqual(host.head().domains.savepoints, before, JSON.stringify(op));
        assert.equal(host.store.problems().length > 0, true, JSON.stringify(op));
        record.ops.splice(0, record.ops.length, ...saved);
        host.store.rebuild();
    }
});

// ---- 4. the participants, looked at again where the commit is ------------------------------------------------------------------

const broken = () => ({ id: 'tl-broken', name: 'Broken', version: '1.0.0', participant: { schema: 1, checkpoint() {} } });

test('a participant that fails to register after the restore was prepared holds the activation: nothing is installed, the preparation is aborted', async t => {
    const w = await world(t);
    const { host, native, hook, saved } = w;
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    hook.on = async phase => { if (phase === 'activate.checked') await host.sdk.registerModule(broken()); };
    const result = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(result.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(result.message, /tl-broken/);
    assert.equal(host.head().domains.progress.xp, 140, 'nothing was restored');
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false);
    assert.equal(host.timeline.host.journal().find(entry => entry.id === prepared.prepared).phase, 'aborted');
    assert.equal(host.registry.restore().state, 'idle');
});

test('a participant registered after the restore was prepared is a participant the save never held: the activation is refused', async t => {
    const w = await world(t);
    const { host, native, hook, saved } = w;
    const head = await host.sdk.timeline.head();
    const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
    assert.equal(prepared.ok, true, prepared.message);
    hook.on = async phase => {
        if (phase !== 'activate.checked') return;
        const late = nativeModule({ id: 'tl-late' });
        late.def.domains = {};
        await host.sdk.registerModule(late.def);
    };
    const result = await host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    assert.equal(result.code, 'SNAPSHOT_UNAVAILABLE');
    assert.match(result.message, /tl-late/);
    assert.equal(host.head().domains.progress.xp, 140);
    assert.equal(native.native.calls.some(call => call.name === 'activate'), false);
});

test('a participant that registers, or fails to, while a save point is made holds the commit: the descriptor would leave it out', async t => {
    for (const [name, def] of [['a participant that fails to register', broken()], ['a participant that registers', (() => { const late = nativeModule({ id: 'tl-late' }); late.def.domains = {}; return late.def; })()]]) {
        const w = await world(t);
        const { host, hook } = w;
        const before = Object.keys(host.head().domains.savepoints.points).length;
        hook.on = async phase => { if (phase === 'make.archived') await host.sdk.registerModule(def); };
        const result = await host.sdk.timeline.make({ kind: 'manual', name: 'Left out' });
        hook.on = null;
        assert.equal(result.code, 'SNAPSHOT_UNAVAILABLE', name);
        assert.equal(Object.keys(host.head().domains.savepoints.points).length, before, `${name}: no descriptor was stored`);
    }
});

test('a native event whose participant answers another schema than it registered is not journaled', async t => {
    let skew = false;
    const w = await world(t, { wrap: native => {
        const real = native.def.participant.checkpoint;
        native.def.participant.checkpoint = input => ({ ...real(input), schema: skew ? 9 : 1 });
    } });
    const { host } = w;
    skew = true;
    const head = await host.sdk.timeline.head();
    const result = await host.timeline.host.nativeEvent({ event: 'ev_schema001', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash });
    assert.equal(result.code, 'SNAPSHOT_UNAVAILABLE');
    assert.equal(host.timeline.host.journal().some(entry => entry.kind === 'native-event'), false);
});

// ---- registration -------------------------------------------------------------------------------------------------------------

test('settings.rules is a settings field this Story Block knows: registering it warns of nothing', () => {
    assert.deepEqual(definitionWarnings({ id: 'x', settings: { rules: ['difficulty'], defaults: {} } }).filter(line => /rules/.test(line)), []);
    assert.match(definitionWarnings({ id: 'x', settings: { panel: () => {} } }).join(), /"settings.panel" is not a settings field/);
});
