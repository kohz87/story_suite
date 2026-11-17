// The reader's trip before its first leg starts (`atlas.trip` phase `planned`, G8): a card asked at a story minute earlier than the trip's
// first leg (a swipe back, a rewind, an earlier reply's card) says `planned` and when it leaves; at and after the start nothing changes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { tripOf } from '../../../modules/atlas/atlas/trip.js';
import { tripQuery } from '../../../modules/atlas/atlas/trip-query.js';
import { selectNow } from '../../../ui/select/now.js';

const PACK = readFileSync(new URL('../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

async function host() {
    let h = null;
    const module = createModule({ host: { settings: id => h?.sdk.settings(id) ?? null, substitute: text => h?.sdk.substitute(text) } });
    h = await createHost({ modules: [module], settings: { features: { 'story-director.pulse': false } } });
    await h.packs.packs.install(PACK, { origin: 'pack.json' });
    await h.send('On.', said('R.', ['~ place Bluewatch Village', '~ trip Wolfmere Outpost | by: foot']));
    return h;
}

// The query as the screens ask it, with the story clock set to `minutes` (the state's own atlas and legs stay).
const asked = (h, minutes) => {
    const state = structuredClone(h.head());
    const tools = { query: (name, args) => (name === 'director.time' ? { minutes } : h.sdk.query(name, args)) };
    return tripQuery(state, {}, tools);
};

test('a trip asked before its first leg starts is planned, and the Now card shows it', async () => {
    const h = await host();
    const start = tripOf(h.head().domains.atlas).legs[0].start;
    const live = h.sdk.query('atlas.trip');
    assert.equal(live.phase, 'road');
    assert.equal(Object.hasOwn(live, 'departs'), false);
    const before = asked(h, start - 60);
    assert.equal(before.phase, 'planned');
    assert.equal(typeof before.departs, 'string');
    const card = selectNow({ 'atlas.trip': before }).today.trip;
    assert.equal(card.state, 'planned');
    assert.equal(card.title, 'Wolfmere Outpost');
    assert.equal(card.progressPct, 0);
    assert.match(card.detail, /leaves /);
});

test('a trip already on the road reads as it always did', async () => {
    const h = await host();
    const start = tripOf(h.head().domains.atlas).legs[0].start;
    const { phase, departs, ...onRoad } = asked(h, start + 60);
    assert.equal(phase, 'road');
    assert.equal(departs, undefined);
    const { phase: p0, departs: d0, ...live } = h.sdk.query('atlas.trip');
    assert.equal(p0, 'road');
    assert.equal(selectNow({ 'atlas.trip': asked(h, start + 60) }).today.trip.state, 'road');
    assert.equal(onRoad.legs.length, live.legs.length);
    // The map's marker and the road line do not change before the start: `you` is as tripView gave it.
    assert.equal(asked(h, start - 60).you?.t, 0);
});
