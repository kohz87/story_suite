import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { BATCH, DEATH, NATIVE, NPC, clone, nativeModule, rulesModule, seal, track } from './helpers/timeline.js';

export const reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const cmd = async (host, type, payload = {}) => assert.equal((await host.sdk.command(type, payload)).ok, true, type);

// A story with a save and a dead timeline on top of it; `disk` is what the last save wrote; `flushes` counts the timeline's flushes
// and fails the one numbered `failing` (1 based). `told` lists the savepoint receipts announced, each with whether the file had it.
const mocked = new WeakSet();
export async function world(t, { failing = 0, scenario = null, wrap = null, more = false, onFail = null } = {}) {
    if (!mocked.has(t)) {
        mocked.add(t);
        t.mock.timers.enable({ apis: ['setTimeout'] });
        t.mock.method(console, 'warn', () => {});
    }
    const native = nativeModule();
    const w = { native, breaches: [] };
    if (scenario) watch(w, scenario);
    if (wrap) wrap(native);
    const hook = { at: async phase => { await hook.on?.(phase); } };
    const host = await createHost({ modules: [rulesModule(), native.def], timelineFaults: hook });
    t.after(() => host.close());
    await host.send('Go.', reply('A.', ['+ coin 10']));
    await cmd(host, 'tl.xp', { amount: 40 });
    const saved = (await host.sdk.timeline.make({ kind: 'manual', name: 'Save' })).snapshot;
    // (`more`: the work after the save is on a reply of its own, which a test can delete)
    if (more) await host.send('More.', reply('B.'));
    const disk = track(host);
    w.disk = disk;
    await cmd(host, 'tl.xp', { amount: 100 });
    native.native.edit(state => { state.dossiers.tavi.trust = 99; });
    await seal(host);
    const counter = { n: 0, failing, failed: false };
    const flush = host.store.flush.bind(host.store);
    host.store.flush = async (...args) => {
        counter.n += 1;
        if (counter.n === counter.failing) {
            counter.failed = true;
            await onFail?.(host);
            throw new Error('the disk is full (test)');
        }
        return flush(...args);
    };
    const told = [];
    host.events.on('committed', ({ receipt }) => told.push({
        type: receipt.type, id: receipt.id, onDisk: JSON.stringify(disk.image.chat).includes(receipt.id),
        present: host.store.receipts().some(each => each.receipt.id === receipt.id),
    }));
    return Object.assign(w, { host, hook, saved, disk, counter, told, modules: () => [rulesModule(), native.def] });
}
export const journalOf = disk => Object.values(disk.image.metadata.storySuite?.timeline?.journal ?? {});
export const diskHas = (disk, type) => JSON.stringify(disk.image.chat).includes(`"type":"${type}"`);

// What each kind of operation does, and what the file must hold once it is told done.
export const SCENARIOS = {
    'a save point': {
        run: ({ host }) => host.sdk.command('savepoint.make', { name: 'Sweep' }),
        done: ({ disk }) => diskHas(disk, 'savepoint.make') && journalOf(disk).some(entry => entry.kind === 'make' && entry.phase === 'committed'),
    },
    'a restore': {
        run: async ({ host, saved }) => {
            const head = await host.sdk.timeline.head();
            const prepared = await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
            if (!prepared.ok) return prepared;
            return host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
        },
        done: ({ disk }) => diskHas(disk, 'savepoint.complete') && journalOf(disk).some(entry => entry.kind === 'restore' && entry.phase === 'complete'),
    },
    'a native event': {
        run: async ({ host }) => {
            const head = await host.sdk.timeline.head();
            return host.timeline.host.nativeEvent({ event: 'ev_sweep0001', participant: NATIVE, kind: 'confirmed-death', npc: NPC, expectedHead: head.headHash });
        },
        done: ({ disk }) => journalOf(disk).some(entry => entry.kind === 'native-event' && entry.phase === 'done'),
    },
    'a native mutation': {
        run: async ({ host, native }) => {
            const head = await host.sdk.timeline.head();
            return native.native.handle.nativeMutation({
                participant: NATIVE, source: host.store.sourceAt(host.store.headIndex()), expectedHead: head.headHash,
                prepare: async () => {
                    const before = native.native.checkpoint();
                    const next = clone(native.native.store);
                    next.dossiers.tavi.trust = 7;
                    const after = native.native.keep(next);
                    native.native.prepared.pr_sweep0001 = { checkpoint: after.checkpoint };
                    return { before: { module: NATIVE, ...before, schema: 1 }, after: { module: NATIVE, ...after, schema: 1 }, prepared: 'pr_sweep0001' };
                },
            });
        },
        done: ({ disk }) => journalOf(disk).some(entry => entry.kind === 'native-mutation' && entry.phase === 'done'),
    },
};

// The participant is never asked to change before the file has the journal (or the restore) that says it should.
function watch(w, scenario) {
    const { native } = w;
    const wrap = (name, ok) => {
        const real = native.def.participant[name];
        native.def.participant[name] = input => {
            if (!ok(input)) w.breaches.push(`${name} before its journal was saved`);
            return real(input);
        };
    };
    if (scenario === 'a native event') wrap('applyEvent', input => journalOf(w.disk).some(entry => entry.kind === 'native-event' && entry.event === input.event));
    if (scenario === 'a native mutation') wrap('activate', input => journalOf(w.disk).some(entry => entry.kind === 'native-mutation' && entry.preparedId === input.prepared));
    if (scenario === 'a restore') wrap('activate', () => diskHas(w.disk, 'savepoint.restore'));
}

// Another chat (its own host, its own file), ready to be opened on `host`, and the way back.
export async function otherChat(t) {
    const b = await createHost({ modules: [rulesModule(), nativeModule().def] });
    t.after(() => b.close());
    await b.send('Hi.', reply('Over there.', ['+ coin 1']));
    return { chat: [...b.ctx.chat], metadata: b.ctx.chatMetadata, snapshot: clone(b.ctx.chatMetadata) };
}
export async function open(host, to) {
    const left = { chat: [...host.ctx.chat], metadata: host.ctx.chatMetadata };
    host.ctx.chat.splice(0, host.ctx.chat.length, ...to.chat);
    host.ctx.chatMetadata = to.metadata;
    await host.turn.onChatChanged();
    return left;
}
export const announced = w => w.told.map(each => each.id);

export const tick = () => new Promise(resolve => setImmediate(resolve));
export const until = async check => { for (let i = 0; i < 200 && !check(); i++) await tick(); return check(); };
// Holds the first arrival at `phase` until `release()`.
export function hold(w, phase) {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let used = false;
    w.hook.on = async at => { if (at === phase && !used) { used = true; await held; } };
    return { release, reached: () => used };
}
export const HOLD_AT = { 'a save point': 'make.checkpointed', 'a restore': 'prepare.participant:tl-native', 'a native event': 'native.journaled', 'a native mutation': 'native.prepared' };
