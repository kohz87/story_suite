// The people sync against a fake host sdk (P3): hydrate replaces the cache with the store's slice and remembers the reply; commit sends for that reply only; equal hashes skip;
// STALE (or a store that moved underneath) discards the work and hydrates again; a hydrate sends nothing; other failures are told.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleSync } from '../../modules/people/adapter/people-sync.js';
import { hashJson } from '../../modules/people/adapter/hash.js';

const view = state => (state ? { v: 1, order: state.npcs.map(n => n.id), npcs: Object.fromEntries(state.npcs.map(n => [n.id, { ...n }])) } : null);
const restore = slice => (slice && slice.v === 1 ? { npcs: slice.order.map(id => ({ ...slice.npcs[id] })) } : null);
const stateOf = (...names) => ({ npcs: names.map(name => ({ id: name.toLowerCase(), name })) });

function rig({ hasSdk = true, failWith = [], source = { sid: 'a', swipeKey: 1 }, slice } = {}) {
    const fake = { sent: [], slice: slice ?? null, failWith: [...failWith], warned: [], source, cache: stateOf(), installs: 0, headOk: true };
    const sdk = {
        query: name => (name === 'people.hash' ? (fake.slice ? hashJson(fake.slice) : null) : undefined),
        view: () => ({ state: { domains: fake.slice ? { people: fake.slice } : {} } }),
        timeline: { head: async () => (fake.headOk ? { ok: true, source: fake.source } : { ok: false, code: 'RESTORE_PENDING' }) },
        command: async (type, payload, options) => {
            fake.sent.push({ type, payload, options });
            const code = fake.failWith.shift();
            if (code) return { ok: false, code, message: code };
            fake.slice = payload.view;
            return { ok: true };
        },
    };
    const sync = createPeopleSync({
        sdk: () => (hasSdk ? sdk : null), view, restore, hash: hashJson, warn: text => fake.warned.push(text),
        readState: () => fake.cache, install: keys => { fake.cache = keys; fake.installs += 1; return true; },
    });
    return { fake, sync };
}
const slice = (...names) => view(stateOf(...names));

test('no host sdk, no state, no hydrate or no reply: nothing is sent', async () => {
    const none = rig({ hasSdk: false });
    assert.equal((await none.sync.commit(stateOf('Mira'))).sent, false);
    const { fake, sync } = rig({ slice: slice() });
    assert.equal((await sync.commit(stateOf('Mira'))).sent, false, 'the cache stands on no reply until it is hydrated');
    await sync.hydrate();
    assert.equal((await sync.commit(null)).sent, false);
    const empty = rig({ slice: slice(), source: null });
    await empty.sync.hydrate();
    assert.equal((await empty.sync.commit(stateOf('Mira'))).sent, false, 'a chat with no reply yet has no carrier');
    assert.equal(fake.sent.length + empty.fake.sent.length, 0);
});

test('hydrate puts the store\'s people into the cache and sends nothing', async () => {
    const { fake, sync } = rig({ slice: slice('Mira', 'Vale') });
    const out = await sync.hydrate();
    assert.equal(out.hydrated, true);
    assert.deepEqual(fake.cache.npcs.map(n => n.id), ['mira', 'vale']);
    assert.deepEqual(sync.source(), { sid: 'a', swipeKey: 1 });
    assert.equal(fake.sent.length, 0);
    assert.equal((await sync.commit(fake.cache)).skipped, true, 'the hydrated cache equals the store: nothing to send');
    assert.equal(fake.sent.length, 0);
});

test('one people.write per change, carrying the view and the reply the cache stands on', async () => {
    const { fake, sync } = rig({ slice: slice('Mira') });
    await sync.hydrate();
    const out = await sync.commit(stateOf('Mira', 'Vale'));
    assert.equal(out.sent, true);
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].type, 'people.write');
    assert.deepEqual(fake.sent[0].payload.view.order, ['mira', 'vale']);
    assert.deepEqual(fake.sent[0].payload.source, { sid: 'a', swipeKey: 1 });
    assert.equal(fake.sent[0].options.background, true);
});

test('sync hydrates only when the reply or the store moved; a commit that finds the store moved is discarded', async () => {
    const { fake, sync } = rig({ slice: slice('Mira') });
    await sync.hydrate();
    assert.equal((await sync.sync()).hydrated, false, 'nothing moved');
    fake.source = { sid: 'b', swipeKey: 1 };
    fake.cache = stateOf('Mira', 'Cast');   // work made for the new reply and not committed yet
    assert.equal((await sync.sync()).hydrated, false, 'a new reply with the same people in the store: nothing is replaced');
    assert.equal(fake.installs, 1);
    assert.deepEqual(fake.cache.npcs.map(n => n.id), ['mira', 'cast'], 'the uncommitted work survives');
    assert.deepEqual(sync.source(), { sid: 'b', swipeKey: 1 }, 'the cache stands on the new reply');
    assert.equal((await sync.commit(fake.cache)).sent, true);
    assert.deepEqual(fake.sent.at(-1).payload.source, { sid: 'b', swipeKey: 1 }, 'and its next commit carries the new reply');
    fake.slice = slice('Tom');   // a middle delete: same reply, other people
    assert.equal((await sync.sync()).hydrated, true, 'the store moved under the same reply');
    assert.deepEqual(fake.cache.npcs.map(n => n.id), ['tom']);
    fake.slice = slice('Zed');
    const out = await sync.commit(stateOf('Tom', 'Vale'));
    assert.deepEqual([out.sent, out.stale], [false, true], 'the change belonged to people that are gone');
    assert.equal(fake.sent.length, 1, 'only the earlier commit was sent');
    assert.deepEqual(fake.cache.npcs.map(n => n.id), ['zed']);
});

test('STALE (the head moved) is dropped without a warning and the cache hydrates again', async () => {
    const { fake, sync } = rig({ slice: slice('Mira'), failWith: ['STALE'] });
    await sync.hydrate();
    fake.source = { sid: 'b', swipeKey: 1 };
    const first = await sync.commit(stateOf('Mira', 'Vale'));
    assert.deepEqual([first.sent, first.stale], [false, true]);
    assert.equal(fake.warned.length, 0);
    assert.deepEqual(sync.source(), { sid: 'b', swipeKey: 1 }, 'the cache stands on the new reply');
    assert.deepEqual(fake.cache.npcs.map(n => n.id), ['mira'], 'the discarded work is gone from the cache');
    assert.equal((await sync.commit(stateOf('Mira', 'Vale'))).sent, true);
});

test('a head the host cannot give yet (a restore pending) hydrates nothing', async () => {
    const { fake, sync } = rig({ slice: slice('Mira') });
    fake.headOk = false;
    assert.equal((await sync.hydrate()).hydrated, false);
    assert.equal(fake.installs, 0);
});

test('a failed send other than STALE is told', async () => {
    const bad = rig({ slice: slice('Mira'), failWith: ['INVALID'] });
    await bad.sync.hydrate();
    assert.equal((await bad.sync.commit(stateOf('Mira', 'Vale'))).sent, false);
    assert.equal(bad.fake.warned.length, 1);
});
