// The people mirror against a fake host sdk: off states, the published state is what is sent, equal hashes skip, STALE is owed and re-sent, heal waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleMirror } from '../src/adapter/people-mirror.js';
import { hashJson } from '../src/storysuite-participant/hash.js';

const view = state => (state ? { v: 1, order: state.npcs.map(n => n.id), npcs: Object.fromEntries(state.npcs.map(n => [n.id, { ...n }])) } : null);
const stateOf = (...names) => ({ npcs: names.map(name => ({ id: name.toLowerCase(), name })) });

function rig({ flag = true, query = true, live = stateOf('Mira'), settled = async () => true, idle = async () => true, busy = () => false, failWith = [] } = {}) {
    const fake = { sent: [], stored: null, flag, failWith: [...failWith], listeners: [], headCalls: 0 };
    const sdk = {
        query: name => (name === 'people.mirrorOn' ? fake.flag : name === 'people.hash' ? fake.stored : undefined),
        command: async (type, payload, options) => {
            fake.sent.push({ type, payload, options });
            const code = fake.failWith.shift();
            if (code) return { ok: false, code, message: code };
            fake.stored = hashJson(payload.view);
            return { ok: true };
        },
        on: (name, fn) => { fake.listeners.push([name, fn]); return () => { fake.listeners.length = 0; }; },
        timeline: { head: async () => { fake.headCalls += 1; return { ok: true, source: { sid: 'h', swipeKey: 0 } }; } },
    };
    const ticks = [];
    const mirror = createPeopleMirror({
        sdk: () => (query ? sdk : { timeline: sdk.timeline }),
        view, hash: hashJson, readState: () => fake.live, warn: text => fake.warned.push(text),
        settled: () => settled(), idle, catchUp: busy, schedule: fn => ticks.push(fn),
    });
    fake.live = live;
    fake.warned = [];
    return { fake, mirror, ticks };
}

test('off when the query is missing or false: nothing is sent', async () => {
    const missing = rig({ query: false });
    assert.equal((await missing.mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a' } })).off, true);
    assert.equal((await missing.mirror.heal()).off, true);
    const off = rig({ flag: false });
    assert.equal((await off.mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a' } })).off, true);
    assert.equal(off.fake.sent.length, 0);
    assert.equal(missing.fake.sent.length, 0);
});

test('one send per publication, carrying the published state and its source, not the live one', async () => {
    const { fake, mirror } = rig({ live: stateOf('Mira', 'Vale') });
    const out = await mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a', swipeKey: 2, extra: 1 } });
    assert.equal(out.sent, true);
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].type, 'people.mirror');
    assert.deepEqual(fake.sent[0].payload.view.order, ['mira']);
    assert.deepEqual(fake.sent[0].payload.source, { sid: 'a', swipeKey: 2 });
    assert.equal(fake.sent[0].options.background, true);
});

test('an equal hash is skipped', async () => {
    const { fake, mirror } = rig();
    await mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a' } });
    await mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'b' } });
    assert.equal(fake.sent.length, 1);
    assert.equal(mirror.stats().skipped, 1);
    await mirror.onPublished({ state: stateOf('Mira', 'Vale'), source: { sid: 'c' } });
    assert.equal(fake.sent.length, 2);
});

test('STALE is owed, then re-sent with the next publication', async () => {
    const { fake, mirror } = rig({ failWith: ['STALE'] });
    const first = await mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a' } });
    assert.equal(first.sent, false);
    assert.deepEqual([mirror.stats().owed, mirror.stats().stale], [true, 1]);
    assert.equal(fake.warned.length, 0);
    const next = await mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'b' } });
    assert.equal(next.sent, true);
    assert.equal(fake.sent.length, 2);
    assert.equal(mirror.stats().owed, false);
    // a failed send other than STALE is owed and told
    const bad = rig({ failWith: ['INVALID'] });
    await bad.mirror.onPublished({ state: stateOf('Mira'), source: { sid: 'a' } });
    assert.equal(bad.fake.warned.length, 1);
    assert.equal(bad.mirror.stats().owed, true);
});

test('heal waits for the barrier, for idle scans and for a catch-up, then mirrors the live state at the head', async () => {
    const gate = { barrier: false, scanning: true, replay: true };
    const { fake, mirror, ticks } = rig({ settled: async () => !gate.barrier, idle: async () => !gate.scanning, busy: () => gate.replay, live: stateOf('Mira') });
    gate.barrier = true;
    assert.equal((await mirror.heal()).waiting, true);
    gate.barrier = false;
    assert.equal((await mirror.heal()).waiting, true);
    gate.scanning = false;
    assert.equal((await mirror.heal()).waiting, true);
    assert.equal(fake.sent.length, 0);
    assert.equal(ticks.length, 3, 'each wait schedules a look again');
    gate.replay = false;
    const done = await mirror.heal();
    assert.equal(done.healed, true);
    assert.equal(fake.sent.length, 1);
    assert.deepEqual(fake.sent[0].payload.source, { sid: 'h', swipeKey: 0 });
    assert.equal(mirror.stats().healed, 1);
    // equal hashes: no second heal
    assert.equal((await mirror.heal()).healed, false);
    assert.equal(fake.sent.length, 1);
});

test('start() heals on the head event and stops on the returned function', async () => {
    const { fake, mirror } = rig({ live: stateOf('Mira') });
    const stop = mirror.start();
    assert.equal(fake.listeners[0][0], 'head');
    fake.listeners[0][1]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fake.sent.length, 1);
    stop();
    assert.equal(fake.listeners.length, 0);
});
