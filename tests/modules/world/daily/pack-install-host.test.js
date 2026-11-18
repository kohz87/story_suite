// WEINT item 1, closed: real packs carrying spec parts install on the host (no test override). With the switch on the daily step runs the
// pack's events and replay == live through swipe, swipe back, edited Re-reads (grown, shrunk), a middle delete, a rewind, a reload and a chat
// change; with the switch off the world parts are kept and inert (the same model-facing text as the pack without them).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { sample } from '../../../packs/helpers/world-pack-sample.js';
import { chronicle, dailyReceipts, FEATURE, reply } from './daily-host.helpers.js';

const clone = value => JSON.parse(JSON.stringify(value));
const SETTINGS = { modules: { 'story-director': { 'tracker.maxJump': 60 } } };
const world = host => JSON.stringify({ daily: chronicle(host).daily ?? null, conditions: chronicle(host).conditions ?? null, time: host.head().domains.director?.time?.minutes ?? null });
const minutes = host => host.head().domains.director.time.minutes;

// A small world the daily step can read whole (no thresholds): a levy that sets unrest on day 2, with realms, kind maps and named routes.
const SMALL = {
    id: 'world-real', version: '1.0.0', name: 'World real', format: 3, requires: { storyBlock: '^2' },
    content: {
        placeKinds: { town: 'town' }, routeKinds: { road: 'road', river: 'river' },
        realms: [{ id: 'march-realm', name: 'March Realm', regions: ['the-march'] }],
        places: [{ id: 'highmark', name: 'Highmark', region: 'the-march', x: 0, y: 0, kind: 'town' }, { id: 'bluewatch', name: 'Bluewatch', region: 'the-march', x: 5, y: 5, kind: 'town', weight: 2 }],
        routes: [{ name: 'Highmark road', from: 'Highmark', to: 'Bluewatch', kind: 'road', km: 80 }, { name: 'Highmark river', from: 'Highmark', to: 'Bluewatch', kind: 'river', km: 90 }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.' }],
        worldEvents: [{ id: 'levy', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '2 days' }, ends_when: { for: '3 days' }, effects: { set: ['unrest@Highmark'] }, summary: 'The lord calls a levy.' }],
    },
};

async function newHost(pack, on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: SETTINGS });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(JSON.stringify(pack), { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}

/** Rebuild equals live, and a fresh host with the same pack loading the same chat agrees. */
async function agrees(host, pack, on, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await newHost(pack, on);
    try {
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains), JSON.stringify(host.head().domains), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}

test('switch on: the real pack sets its condition; swipe, swipe back, edited Re-reads, middle delete, rewind, reload and chat change keep replay == live', async () => {
    const host = await newHost(SMALL, true);
    assert.deepEqual(host.sdk.query('packs.content', { kind: 'worldEvents' }).map(event => event.id), ['levy']);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('Days.', reply('Three days pass.', ['! time +3d']));
    const crossing = host.ctx.chat.length - 1;
    assert.ok(JSON.stringify(chronicle(host)).includes('unrest'), 'the levy set unrest');
    assert.ok(dailyReceipts(host).some(entry => entry.index === crossing));
    const before = world(host);
    await host.swipe(reply('Three days, grey.', ['! time +3d']));
    assert.equal(world(host), before, 'a swipe of the crossing reply: the same world');
    await agrees(host, SMALL, true, 'swipe');
    await host.st.swipeTo(crossing, 0);
    assert.equal(world(host), before, 'swipe back');
    await agrees(host, SMALL, true, 'swipe back');
    await host.send('Next.', reply('Noon.', ['! time +2h']));
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +1h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    // A shrunk Re-read steps no day; when the old step had fired something, a 0-day step stays to carry the "no longer fired" warning (WEC2, E21).
    assert.equal(dailyReceipts(host).some(entry => entry.index === crossing && entry.receipt.data.days > 0), false, 'shrunk: no day stepped');
    await agrees(host, SMALL, true, 'shrunk Re-read');
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +6d']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(dailyReceipts(host).find(entry => entry.index === crossing).receipt.data.days, 6, 'grown: the days are stepped');
    await agrees(host, SMALL, true, 'grown Re-read');
    await host.st.deleteMessage(crossing);
    assert.deepEqual(host.store.problems(), []);
    await agrees(host, SMALL, true, 'middle delete');
    const chat = structuredClone(host.ctx.chat);
    await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
    assert.equal(chronicle(host).daily, undefined, 'another chat has no world days');
    await host.st.loadChat(chat);
    await agrees(host, SMALL, true, 'chat change and back');
    while (host.ctx.chat.length > 3) await host.st.deleteMessage(host.ctx.chat.length - 1);
    await agrees(host, SMALL, true, 'rewound');
    host.close();
});

// Randomness and the clock are seeded (as the cross-tree off check does) so two plays can be compared exactly.
async function playOff(pack) {
    const real = { random: Math.random, now: Date.now, uuid: globalThis.crypto.randomUUID, values: globalThis.crypto.getRandomValues };
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
    let tick = 1_700_000_000_000;
    Math.random = rnd;
    Date.now = () => (tick += 1000);
    globalThis.crypto.getRandomValues = array => { for (let i = 0; i < array.length; i++) array[i] = Math.floor(rnd() * 256); return array; };
    globalThis.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => Math.floor(rnd() * 16).toString(16));
    try { return await playOffSeeded(pack); } finally { Math.random = real.random; Date.now = real.now; globalThis.crypto.randomUUID = real.uuid; globalThis.crypto.getRandomValues = real.values; }
}

async function playOffSeeded(pack) {
    const host = await newHost(pack, false);
    const mark = host.st.promptLog.length;
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Highmark Capital']));
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('Days.', reply('Three days pass.', ['! time +3d']));
    await host.swipe(reply('Three days, grey.', ['! time +3d']));
    await host.send('Next.', reply('Noon.', ['! time +2h']));
    const out = { prompts: host.st.promptLog.slice(mark).map(entry => [entry.key, entry.value]), requests: host.st.requests.map(request => JSON.stringify(request)), chat: host.ctx.chat.map(message => message.mes), problems: host.store.problems(), chronicle: chronicle(host), atlas: JSON.stringify(['atlas.routes', 'director.world', 'director.world.here'].map(name => host.sdk.query(name, {}))) };
    host.close();
    return out;
}

test('switch off, the full sample world pack: installs, plays, nothing steps, no "undefined" in the text the model gets, no Problems, and the cast figures cause no throw', async () => {
    const out = await playOff(sample);
    assert.deepEqual(out.problems, []);
    assert.equal(out.chronicle.daily, undefined);
    assert.equal(out.chronicle.conditions, undefined);
    assert.equal(/undefined/.test(JSON.stringify([out.prompts, out.requests])), false, 'no "undefined" in prompts or requests');
});

test('switch off: the world parts are inert: the same prompts, requests and chat as the same pack without them', async () => {
    const stripped = clone(SMALL);
    for (const kind of ['placeKinds', 'routeKinds', 'realms', 'worldEvents']) delete stripped.content[kind];
    delete stripped.content.places[1].weight;
    for (const place of stripped.content.places) { place.slug = place.id; delete place.id; }
    stripped.content.routes = stripped.content.routes.slice(0, 1);
    const withParts = clone(SMALL);
    withParts.content.routes = withParts.content.routes.slice(0, 1);
    const [a, b] = [await playOff(withParts), await playOff(stripped)];
    assert.deepEqual(a.prompts, b.prompts);
    assert.deepEqual(a.requests, b.requests);
    assert.deepEqual(a.chat, b.chat);
    assert.deepEqual(a.problems, b.problems);
    assert.match(a.atlas, /Bluewatch/, 'the atlas answers (the comparison is not empty)');
    assert.equal(a.atlas, b.atlas, 'the atlas and world queries answer the same');
    assert.equal(JSON.stringify(a.chronicle), JSON.stringify(b.chronicle));
});

test('minutes advance only by the replies: with the switch off no fallback hour is added by the world pack', async () => {
    const host = await newHost(SMALL, false);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const start = minutes(host);
    await host.send('Rest.', reply('A quiet night.'));
    assert.equal(minutes(host), start);
    host.close();
});
