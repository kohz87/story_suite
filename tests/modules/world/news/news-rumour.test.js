// Ruling 53: news beyond its reach travels as rumour one step further, by courier time, never as fact; minor happenings are fact only in their own region.
import test from 'node:test';
import assert from 'node:assert/strict';

import { heardHere } from '../../../../modules/world/world/news.js';
import { DAY, hostFor } from './helpers.js';
import { clockAt, makeState, sceneAt } from '../chronicle/helpers/fake-ctx.js';

const PACK = {
    realms: [{ id: 'a', name: 'Realm A', regions: ['Shackles', 'Reach'] }, { id: 'b', name: 'Realm B', regions: ['Auvoth'] }, { id: 'c', name: 'Realm C', regions: ['Farland'] }],
    placeKinds: [{}], routeKinds: [{ road: 'road' }],
    places: [
        { name: 'Shackles City', region: 'Shackles', kind: 'town', x: 0, y: 0 }, { name: 'Bluewatch', region: 'Reach', kind: 'town', x: 1, y: 0 },
        { name: 'Auvoth', region: 'Auvoth', kind: 'town', x: 2, y: 0 }, { name: 'Faraway', region: 'Farland', kind: 'town', x: 9, y: 9 }, { name: 'Shackles Port', region: 'Shackles', kind: 'town', x: 0, y: 1 },
    ],
    routes: [{ from: 'Shackles City', to: 'Auvoth', kind: 'road', km: 120 }, { from: 'Shackles City', to: 'Bluewatch', kind: 'road', km: 60 }, { from: 'Shackles City', to: 'Shackles Port', kind: 'road', km: 30 }],
    worldEvents: [{ id: 'small', severity: 'minor' }],
};
function at(place, day, { reach = 'regional', by = 'event:world.harvest' } = {}) {
    const state = structuredClone(sceneAt(clockAt(makeState({ minutes: day * DAY }), day * DAY), place));
    state.domains.chronicle.events.ev_w0000001 = { id: 'ev_w0000001', name: 'Harvest fails · day 1', summary: 'The harvest fails.', state: 'ongoing', since: DAY, updated: DAY, place: 'Shackles City', factions: [], aka: [], rev: 1, by, reach };
    return heardHere(state, { now: day * DAY }, hostFor(state, { pack: PACK })).map(entry => [entry.tag, entry.place]);
}

test('a regional harvest in Shackles is heard as rumour in Bluewatch and Auvoth after courier time, never confirmed there', () => {
    assert.deepEqual(at('Shackles Port', 2), [['fact', 'Shackles City']], 'confirmed in its region');
    assert.deepEqual(at('Bluewatch', 1.5), [], 'before the courier: nothing');
    assert.deepEqual(at('Bluewatch', 3), [['rumour', 'Shackles']], 'same realm: rumour, and only the region is named');
    assert.deepEqual(at('Auvoth', 3), [['rumour', 'Shackles']], 'a region a route joins');
    assert.deepEqual(at('Faraway', 40), [], 'two steps off: not heard');
});

test('realm news reaches the realm as fact and adjacent realms as rumour; world news is fact everywhere; a minor happening is fact only in its own region', () => {
    assert.deepEqual(at('Auvoth', 5, { reach: 'realm' }), [['rumour', 'Shackles']]);
    assert.deepEqual(at('Bluewatch', 5, { reach: 'realm' }), [['fact', 'Shackles City']]);
    assert.deepEqual(at('Faraway', 40, { reach: 'realm' }), []);
    assert.deepEqual(at('Faraway', 40, { reach: 'world' }), [['fact', 'Shackles City']]);
    assert.deepEqual(at('Bluewatch', 5, { reach: 'realm', by: 'event:world.small' }), [['rumour', 'Shackles']]);
    assert.deepEqual(at('Shackles Port', 5, { by: 'event:world.small' }), [['fact', 'Shackles City']]);
});
