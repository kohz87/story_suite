// A trip stop's id after an edited Re-read: atlas.trip names a pack place by its canonical id (the pack's definition id) whether or not the story
// has made the atlas place yet. A Re-read runs no beforeGenerate, so an edit that adds `~ place` leaves no atlas place until the next send; the leg
// start used to read `pack:<key>` there and a minted `pl_` id in the chat told that way (FUZZHUNT2). The widget finds its map node by name.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { PACK as MAP_PACK, TRIP_DAY, TRIP_T0, draw, story } from './widget.helpers.js';
import { deepFreeze, line, query } from './helpers/fake-ctx.js';
import { anchorTrip } from '../../../modules/atlas/atlas/widget-view-parts/anchor.js';
import { installBluewatch } from '../../fixtures/director/bluewatch.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const GO = ['! time +4 hour', '~ trip Wolfmere Outpost | by: foot'];

async function told(replies) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [module], settings: { features: { 'story-director.pulse': false } } });
    await installBluewatch(host.packs.packs);
    for (const [i, lines] of replies.entries()) await host.send(`On ${i}.`, said(`R${i}.`, lines));
    return host;
}

const legs = host => host.sdk.query('atlas.trip').legs.map(leg => [leg.fromId, leg.toId]);
const replyAt = (host, tag) => host.ctx.chat.findIndex(message => !message.is_user && String(message.mes).startsWith(`${tag}.`));
const ADDED = ['~ place Bluewatch Village', ...GO];

async function editedFirst() {
    const host = await told([GO, ['! time +1 hour']]);
    await host.st.editMessage(replyAt(host, 'R0'), said('R0.', ADDED));
    for (const tag of ['R0', 'R1']) assert.equal((await host.sdk.reread(replyAt(host, tag))).ok, true);
    return host;
}

test('an edit that adds a place line, Re-read: the trip legs name the same places as the story told that way', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await editedFirst();
    const fresh = await told([ADDED, ['! time +1 hour']]);
    t.after(() => { host.close(); fresh.close(); });
    assert.match(legs(fresh)[0][0], /^pack\./, 'the start is the pack definition id');
    assert.deepEqual(legs(host), legs(fresh));
});

test('the leg ids stay the same through the next send and a reload', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await editedFirst();
    t.after(() => host.close());
    const before = legs(host);
    await host.send('On 2.', said('R2.', ['! time +1 hour']));
    assert.deepEqual(legs(host), before, 'the next send mints the atlas place and changes nothing read');
    host.store.rebuild();
    assert.deepEqual(legs(host), before, 'a reload');
});

test('the map widget finds its node by name when the trip names a stop by its canonical id', () => {
    const places = [{ id: 'pl_k3f9a2qz', name: 'Bluewatch Village', aliases: [] }, { id: 'pack:wolfmere outpost', name: 'Wolfmere Outpost', aliases: ['the outpost'] }];
    const trip = {
        on: true, legs: [{ from: 'Bluewatch Village', to: 'the Outpost', fromId: 'pack.ersveil/bluewatch', toId: 'pack.ersveil/wolfmere' }],
        you: { fromId: 'pack.ersveil/bluewatch', toId: 'pack.ersveil/wolfmere', t: 0.5 }, movers: [],
    };
    const out = anchorTrip(trip, places);
    assert.deepEqual([out.legs[0].fromId, out.legs[0].toId], ['pl_k3f9a2qz', 'pack:wolfmere outpost']);
    assert.deepEqual([out.you.fromId, out.you.toId], ['pl_k3f9a2qz', 'pack:wolfmere outpost']);
    const same = anchorTrip({ ...trip, legs: [{ ...trip.legs[0], fromId: 'pl_k3f9a2qz', from: 'x' }] }, places);
    assert.equal(same.legs[0].fromId, 'pl_k3f9a2qz', 'an id that is a node already stays');
    assert.equal(anchorTrip(null, places), null);
});

test('the widget draws the trip over a pack whose places carry definition ids (the legs and the You marker find their nodes)', () => {
    const pack = { ...MAP_PACK, places: MAP_PACK.places.map((place, i) => ({ ...place, id: `pack.demo/place-${i}` })) };
    const first = line(story(), '~ trip Coinwater | by: foot', { pack, time: TRIP_T0 });
    assert.ok(first.ok, first.message);
    const state = deepFreeze({
        ...first.state,
        // The places the story minted are left out: the Re-read case, where the stops are still pack nodes.
        domains: { ...first.state.domains, atlas: { ...first.state.domains.atlas, places: {}, placeRefs: {}, keys: {} }, scene: { place: { name: 'Bluewatch Village', kind: '', region: '' }, present: [] }, director: { time: { minutes: TRIP_T0 + TRIP_DAY }, threads: {} } },
    });
    const trip = query(state, 'atlas.trip', {}, { pack });
    assert.match(trip.legs[0].fromId, /^pack\.demo\//, 'the trip names the stop by its definition id');
    const drawn = draw({ state, value: query(state, 'atlas.view', {}, { pack }), props: { trip } });
    assert.equal(drawn.root.querySelectorAll('.sd-map-trip-leg').length, 2);
    assert.equal(drawn.root.querySelectorAll('.sd-map-you').length, 1);
});
