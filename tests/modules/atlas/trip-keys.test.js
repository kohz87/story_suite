// The trip records after an edited Re-read (PROBLEMSKEY §2): each is keyed by its reply's record ID (`<sid>.<n>`,
// src/v2/reply-keys.js), so a later reply's stored delay never lands on the go the edited reply now writes (the trip itself was
// lost before), and the trip is read in story-time order. Compared with the story told the edited way: the stored records and the
// reader's trip (`atlas.trip`, tripOf). An older state's `<rev>.<n>` records still read; a swipe, a middle delete, a rewind
// and a reload give what live gave.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { tripOf } from '../../../modules/atlas/atlas/trip.js';
import { tripsProblems } from '../../../modules/atlas/atlas/trip-shape.js';

const PACK = readFileSync(new URL('../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const GO = ['~ place Bluewatch Village', '~ trip Wolfmere Outpost | by: foot'];
const pad = n => Array.from({ length: n }, (_, i) => `+ quest P${i} — x | giver: A`);

async function told(replies) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [module], settings: { features: { 'story-director.pulse': false } } });
    await host.packs.packs.install(PACK, { origin: 'pack.json' });
    for (const [i, lines] of replies.entries()) await host.send(`On ${i}.`, said(`R${i}.`, lines));
    return host;
}

const atlas = host => host.head().domains.atlas;
// The stored records in story-time order (a key and a rev name a reply and a receipt, which differ by telling).
const records = host => Object.values(atlas(host).trips ?? {}).map(record => `${record.kind}:${record.at}:${record.to ?? record.minutes}`).sort();
const trip = host => {
    const read = tripOf(atlas(host));
    return read && { to: read.to, delays: read.delays, arrive: read.legs.map(leg => leg.arrive) };
};
// The reader's trip, its place IDs left out (each host draws its own).
const shown = host => JSON.parse(JSON.stringify(host.sdk.query('atlas.trip')).replace(/"pl_[a-z0-9]{8}"/g, '"pl"'));
const replyAt = (host, tag) => host.ctx.chat.findIndex(message => !message.is_user && String(message.mes).startsWith(`${tag}.`));

function sameAsTold(host, fresh, where) {
    assert.deepEqual(records(host), records(fresh), `${where}: the stored records`);
    assert.deepEqual(trip(host), trip(fresh), `${where}: the trip read back`);
    assert.deepEqual(shown(host), shown(fresh), `${where}: the reader's trip`);
    assert.deepEqual(tripsProblems(atlas(host).trips ?? {}), [], `${where}: valid`);
}

function rebuiltSame(host, where) {
    const live = structuredClone(atlas(host).trips ?? null);
    host.store.rebuild();
    assert.deepEqual(atlas(host).trips ?? null, live, `${where}: a reload gives what live gave`);
}

async function rereadFirst(story, padded) {
    const host = await told(story);
    const at = replyAt(host, 'R0');
    await host.st.editMessage(at, said('R0.', [...pad(padded), ...story[0]]));
    const done = await host.sdk.reread(at);
    assert.equal(done.ok, true, done.message);
    const fresh = await told([[...pad(padded), ...story[0]], ...story.slice(1)]);
    return { host, fresh };
}

for (const padded of [8, 10]) {
    test(`the reply that set out, Re-read with ${padded} more lines first: the trip and both delays stay, as told that way`, async t => {
        t.mock.method(console, 'warn', () => {});
        const { host, fresh } = await rereadFirst([GO, ['! time +1 hour'], ['~ trip delay: 1 day | because: shoe'], ['~ trip delay: 2 days | because: rain']], padded);
        t.after(() => { host.close(); fresh.close(); });
        assert.equal(trip(host)?.to, 'Wolfmere Outpost', 'the trip is still there');
        assert.equal(trip(host).delays.length, 2);
        sameAsTold(host, fresh, 'after the Re-read');
        rebuiltSame(host, 'after the Re-read');
        await host.send('More.', said('R4.', ['~ trip delay: 3 hours']));
        await fresh.send('More.', said('R4.', ['~ trip delay: 3 hours']));
        sameAsTold(host, fresh, 'one more reply');
    });
}

test('a delay told at the go\'s own story minute still counts after the go\'s reply is Re-read with more lines', async t => {
    t.mock.method(console, 'warn', () => {});
    const { host, fresh } = await rereadFirst([GO, ['+ quest R — x | giver: A'], ['~ trip delay: 1 day | because: shoe']], 10);
    t.after(() => { host.close(); fresh.close(); });
    assert.equal(trip(host).delays.length, 1);
    sameAsTold(host, fresh, 'same minute');
});

test('a delay an edited earlier reply now writes, for the trip of its time, does not delay a later reply\'s new trip', async t => {
    t.mock.method(console, 'warn', () => {});
    const story = [GO, ['+ quest Q — x | giver: A'], ['~ trip Auvoth | by: foot']];
    const host = await told(story);
    t.after(() => host.close());
    const at = replyAt(host, 'R1');
    await host.st.editMessage(at, said('R1.', ['~ trip delay: 1 day | because: shoe']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    const fresh = await told([GO, ['~ trip delay: 1 day | because: shoe'], story[2]]);
    t.after(() => fresh.close());
    assert.equal(trip(host).to, 'Auvoth');
    assert.deepEqual(trip(host), trip(fresh), 'the trip read back, as told that way: no delay');
    assert.deepEqual(shown(host), shown(fresh), 'the reader\'s trip');
    rebuiltSame(host, 'after the Re-read');
});

test('a delay names the go it delays', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await told([GO, ['! time +1 hour', '~ trip delay: 1 day']]);
    t.after(() => host.close());
    const records = Object.entries(atlas(host).trips);
    const go = records.find(([, record]) => record.kind === 'go')[0];
    assert.match(go, /\.0$/, 'a go is its reply\'s first record');
    assert.equal(records.find(([, record]) => record.kind === 'delay')[1].go, go);
    assert.deepEqual(tripsProblems({ ...atlas(host).trips, 'sw_x.0': { kind: 'delay', at: 1, rev: 1, minutes: 5, because: '', go: 'not a key' } }), ['atlas.trips.sw_x.0.go must be a trip record\'s key.']);
});

// A later trip that had replaced an earlier one is edited away or deleted: the earlier trip stands again, and a delay told after both
// (naming the later go, gone now) counts for it by story time, as told that way.
const replaced = [GO, ['~ trip Auvoth | by: foot'], ['! time +1 hour', '~ trip delay: 1 day | because: shoe']];
for (const [name, edited] of [['to a quest line', ['+ quest Q — x | giver: A']], ['to a delay', ['~ trip delay: 2 hours']]]) {
    test(`a later trip edited away (${name}): a delay that named it counts for the trip that stands again`, async t => {
        t.mock.method(console, 'warn', () => {});
        const host = await told(replaced);
        t.after(() => host.close());
        const at = replyAt(host, 'R1');
        await host.st.editMessage(at, said('R1.', edited));
        assert.equal((await host.sdk.reread(at)).ok, true);
        const fresh = await told([GO, edited, replaced[2]]);
        t.after(() => fresh.close());
        assert.equal(trip(host).to, 'Wolfmere Outpost');
        assert.deepEqual(trip(host), trip(fresh), 'the trip read back, as told that way');
        assert.deepEqual(shown(host), shown(fresh), 'the reader\'s trip');
        rebuiltSame(host, 'after the Re-read');
    });
}

test('a later trip deleted in the middle: a delay that named it counts for the trip that stands again', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await told(replaced);
    t.after(() => host.close());
    const at = replyAt(host, 'R1');
    await host.st.deleteMessage(at);
    await host.st.deleteMessage(at - 1);
    const fresh = await told([GO, replaced[2]]);
    t.after(() => fresh.close());
    assert.equal(trip(host).delays.length, 1);
    assert.deepEqual(trip(host), trip(fresh), 'the trip read back, as told that way');
    rebuiltSame(host, 'after the delete');
});

test('an older chat\'s go Re-read under a new key: a delay that named its old key still counts', () => {
    const leg = { from: 'A', to: 'B', km: 20, kind: 'road', days: 1, start: 100, arrive: 1540 };
    const trips = {
        'sw_r0.0': { kind: 'go', at: 100, rev: 5, to: 'B', by: 'foot', mode: 'foot', pace: 20, unit: 'day', mount: '', short: false, setOut: 100, legs: [leg] },
        'sw_r2.0': { kind: 'delay', at: 160, rev: 13, minutes: 1440, because: '', go: '5.0' },
    };
    assert.deepEqual(tripsProblems(trips), []);
    assert.equal(tripOf({ trips }).delays.length, 1);
    // A delay naming a key that is now another reply's delay (not a go) counts the same way.
    assert.equal(tripOf({ trips: { ...trips, '5.0': { kind: 'delay', at: 150, rev: 7, minutes: 60, because: '' } } }).delays.length, 2);
});

test('an older state\'s <rev>.<n> records read as before; a new delay joins them', () => {
    const leg = { from: 'A', to: 'B', km: 20, kind: 'road', days: 1, start: 100, arrive: 1540 };
    const old = {
        '5.0': { kind: 'go', at: 100, rev: 5, to: 'B', by: 'foot', mode: 'foot', pace: 20, unit: 'day', mount: '', short: false, setOut: 100, legs: [leg] },
        '13.0': { kind: 'delay', at: 160, rev: 13, minutes: 1440, because: '' },
    };
    assert.deepEqual(tripsProblems(old), []);
    const before = tripOf({ trips: old });
    assert.equal(before.legs[0].arrive, 1540 + 1440);
    const mixed = { ...old, 'sw_new.0': { kind: 'delay', at: 200, rev: 20, minutes: 60, because: 'rain' } };
    assert.deepEqual(tripsProblems(mixed), []);
    const after = tripOf({ trips: mixed });
    assert.deepEqual(after.delays.map(delay => delay.minutes), [1440, 60]);
    assert.equal(after.legs[0].arrive, 1540 + 1440 + 60);
    assert.deepEqual(tripsProblems({ ...old, 'not a key': old['13.0'] }), ['atlas.trips.not a key is not a trip record.']);
});

test('a swipe, a middle delete, a rewind and a reload give what the story told that way gives', async t => {
    t.mock.method(console, 'warn', () => {});
    const story = [GO, ['! time +1 hour'], ['~ trip delay: 1 day | because: shoe'], ['~ trip delay: 2 days | because: rain']];
    const host = await told(story);
    t.after(() => host.close());
    await host.swipe(said('R3 again.', ['~ trip delay: 6 hours']));
    const swiped = await told([...story.slice(0, 3), ['~ trip delay: 6 hours']]);
    t.after(() => swiped.close());
    sameAsTold(host, swiped, 'after a swipe');
    rebuiltSame(host, 'after a swipe');

    // A middle delete: the exchange of the first delay goes.
    const at = replyAt(host, 'R2');
    await host.st.deleteMessage(at);
    await host.st.deleteMessage(at - 1);
    const deleted = await told([story[0], story[1], ['~ trip delay: 6 hours']]);
    t.after(() => deleted.close());
    sameAsTold(host, deleted, 'after a middle delete');
    rebuiltSame(host, 'after a middle delete');

    // A rewind to before the last reply's receipts: its delay goes.
    const last = replyAt(host, 'R3 again');
    const first = host.sdk.receipts().find(entry => entry.index === last);
    assert.equal((await host.sdk.rewind({ index: last, beforeRev: first.receipt.rev })).ok, true);
    assert.equal(trip(host).delays.length, 0, 'the rewound reply\'s delay is gone');
    rebuiltSame(host, 'after the rewind');
});
