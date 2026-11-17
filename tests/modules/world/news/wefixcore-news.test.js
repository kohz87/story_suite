// WEFIXCORE (REVENG1 findings 2 and 6): news is timed by the roads as they stood when it set out (a road closed afterwards never
// takes heard news back), and a nameless route with id ends gets its courier factor.
import test from 'node:test';
import assert from 'node:assert/strict';

import { heardHere, newsAt } from '../../../../modules/world/world/news.js';
import { DAY, hostFor } from './helpers.js';
import { clockAt, makeState, sceneAt } from '../chronicle/helpers/fake-ctx.js';

const PACK = {
    places: [
        { id: 'a1', name: 'Alpha', region: 'March', kind: 'town', x: 0, y: 0 },
        { id: 'b1', name: 'Beta', region: 'March', kind: 'town', x: 1, y: 0 },
    ],
    routes: [{ from: 'a1', to: 'b1', kind: 'road', km: 180 }],
    named: [{ from: 'a1', to: 'b1', kind: 'road', km: 180, name: 'high-road' }],
    conditions: [{ name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.', effects: { routes: 'blocked' } }],
};
const FIRED = 10 * DAY;
function world({ day, closedSince = null, at = 'Beta', ref = 'a1-b1' }) {
    const state = structuredClone(sceneAt(clockAt(makeState({ minutes: day * DAY }), day * DAY), at));
    state.domains.chronicle.events.ev_w0000001 = { id: 'ev_w0000001', name: 'The Levy', summary: 'The levy.', state: 'ongoing', since: FIRED, updated: FIRED, place: 'Alpha', factions: [], aka: [], rev: 1, by: 'event:world.levy', reach: 'world' };
    if (closedSince !== null) state.domains.chronicle.conditions = { [`roads-closed@${ref}`]: { name: 'roads-closed', scope: 'route', ref, since: closedSince, fadesAt: null, why: '', by: 'code', rev: 0 } };
    return state;
}
const NAMED = { ...PACK, routes: PACK.named };
const tools = (state, pack = PACK) => hostFor(state, { pack });
const arrival = (state, pack = PACK) => newsAt(state, { entryId: 'ev_w0000001', place: 'Beta' }, tools(state, pack));

test('finding 2: a road closed after the news set out does not take back news that has come', () => {
    const open = world({ day: 14 });
    assert.equal(arrival(open, NAMED).arrivesAt, FIRED + 3 * DAY);
    const closedLater = world({ day: 15, closedSince: 15 * DAY, ref: 'high-road' });
    assert.equal(arrival(closedLater, NAMED).arrivesAt, FIRED + 3 * DAY, 'the courier left on day 10: the closure of day 15 changes nothing');
    assert.equal(heardHere(closedLater, { now: 15 * DAY }, tools(closedLater, NAMED)).length, 1, 'still heard on day 15');
});

test('finding 2: a road already closed when the news set out still delays it', () => {
    const closed = world({ day: 15, closedSince: 5 * DAY, ref: 'high-road' });
    assert.equal(arrival(closed, NAMED).via, 'tier');
    assert.equal(arrival(closed, NAMED).arrivesAt, FIRED + DAY, 'the same region: the reach step of 1 day');
});

test('finding 6: a nameless route with id ends takes the courier factor of its conditions', () => {
    const closed = world({ day: 12, closedSince: 5 * DAY });
    assert.equal(arrival(closed).via, 'tier', 'the blocked road is not used');
});
