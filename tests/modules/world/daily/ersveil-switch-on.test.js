// The shipped Ersveil world with the world-events switch on, on the real host: two months of story (four 15-day skips) fire code-rolled
// happenings as Journal entries, their news reaches other towns by courier time, nothing lands in Problems, and a reload (a fresh host
// loading the chat) gives the same entries, conditions and news. Model calls are refused (busy), so this is the code-fired part alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { FEATURE, reply } from './daily-host.helpers.js';

const ERSVEIL = readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const ERSVEIL_GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const tick = async () => { for (let i = 0; i < 6; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

async function ersveil() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    assert.equal((await host.packs.packs.install(ERSVEIL_GAME, { origin: 'pack.json' })).ok, true);
    return host;
}

const happenings = host => (host.sdk.query('chronicle.events', {}) ?? []).filter(entry => String(entry.by ?? '').startsWith('event:world.'));
// The pack's top-level places (not the spots inside a city); the seed is drawn per chat, so which of them has news by now varies.
const TOWNS = JSON.parse(ERSVEIL).content.places.map(place => place.name).filter(name => typeof name === 'string' && !name.includes('/'));
const top = name => String(name ?? '').split(' / ')[0];
// For each town, the happenings it has heard of that happened at another town: news that travelled.
const travelled = host => Object.fromEntries(TOWNS.map(town => [town, (host.sdk.query('world.heardHere', { place: town }) ?? [])
    .filter(entry => String(entry.by ?? '').startsWith('event:world.') && entry.place && top(entry.place) !== town).map(entry => entry.name)]).filter(([, names]) => names.length));
const seen = host => JSON.stringify({ entries: happenings(host).map(entry => [entry.id, entry.name, entry.since]), travelled: travelled(host), conditions: host.sdk.query('chronicle.conditions', {}) });

test('Ersveil, switch on: two months fire happenings as Journal entries, their news reaches other towns, and a reload agrees', async () => {
    const host = await ersveil();
    let again = null;
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await tick();
        for (let i = 0; i < 4; i += 1) { await host.send(`On ${i}.`, reply(`On ${i}.`, ['! time +15d'])); await tick(); }
        assert.ok(happenings(host).length > 0, 'code-fired happenings are written as Journal entries');
        assert.ok(Object.keys(travelled(host)).length > 0, 'the news of some has reached other towns');
        assert.deepEqual(host.store.problems(), [], 'no store problems');
        const live = seen(host);
        host.store.rebuild();
        assert.equal(seen(host), live, 'rebuild equals live');
        again = await ersveil();
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(seen(again), live, 'a reload: the same entries, news and conditions');
    } finally { again?.close(); host.close(); }
});
