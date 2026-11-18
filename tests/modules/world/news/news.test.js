// News arrival (feature `story-director.world-events`): the courier's time over the routes, tiers where no route joins the places,
// world.newsAt / world.heardHere, the narrator's [World] tail and the Journal's news. All derived: the same state gives the same answer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { chronicleTail } from '../../../../modules/world/chronicle/note.js';
import { knownNews } from '../../../../modules/world/world/known.js';
import { courierDays } from '../../../../modules/atlas/atlas/courier.js';
import { heardHere, newsAt } from '../../../../modules/world/world/news.js';
import { DAY, PACK, hostFor, viewFor, worldAt } from './helpers.js';

const EVENTS = [['Border War', 'Hollin'], ['Coast Fire', 'Glassdock'], ['Far Storm', 'Far Keep'], ['Local Row', 'Wolfmere'], ['Nowhere News', '']];
const at = (state, options) => newsAt(state, { entryId: Object.values(state.domains.chronicle.events).find(e => e.name === options.name).id, place: options.place }, hostFor(state, options));
const ids = (list, state) => list.map(entry => state.domains.chronicle.events[entry.id]?.name ?? entry.name).sort();

test('the courier takes the shortest way over the routes at the courier pace, a route\'s own hours over its km', () => {
    const state = worldAt({ events: [], day: 1 });
    const world = { places: [], routes: [], find: () => null };
    assert.equal(courierDays(world, 'A', 'B'), null);
    const tools = hostFor(state);
    assert.deepEqual(tools.query('atlas.courier', { from: 'Bluewatch', to: 'Wolfmere' }), { days: 3, km: 180, hops: 2 });
    assert.deepEqual(tools.query('atlas.courier', { from: 'Wolfmere', to: 'Bluewatch', kmPerDay: 90 }), { days: 2, km: 180, hops: 2 });
    assert.deepEqual(tools.query('atlas.courier', { from: 'Bluewatch', to: 'Glassdock' }), { days: 4, km: 440, hops: 1 }, 'the river gives its noted 96 hours');
    assert.deepEqual(tools.query('atlas.courier', { from: 'Hollin', to: 'Hollin' }), { days: 0, km: 0, hops: 0 });
    assert.equal(tools.query('atlas.courier', { from: 'Bluewatch', to: 'Far Keep' }), null, 'no chain of routes');
    assert.equal(tools.query('atlas.courier', { from: 'Bluewatch', to: 'Nowhere' }), null);
});

test('world.newsAt (a world line\'s entries): courier time by route class from the entry\'s start, reach steps where no route joins, null with the switch off', () => {
    const state = worldAt({ events: EVENTS, day: 1 });
    // Hollin → Wolfmere: a road (class road, 60 km a day): 60 km = 1 day, from the entry's start (day 1, minute 1440).
    assert.deepEqual(at(state, { name: 'Border War', place: 'Wolfmere' }), { arrivesAt: DAY + DAY, via: 'route', km: 60, days: 1 });
    // The reader's courier pace no longer changes a classed route (spec §1: the class sets the speed).
    assert.deepEqual(at(state, { name: 'Border War', place: 'Wolfmere', kmPerDay: 30 }), { arrivesAt: DAY + DAY, via: 'route', km: 60, days: 1 });
    assert.deepEqual(at(state, { name: 'Local Row', place: 'Wolfmere — Gate' }), { arrivesAt: DAY, via: 'tier', days: 0 });
    // Far Keep has no road: another region than Wolfmere, so the far reach step (10 days).
    assert.deepEqual(at(state, { name: 'Far Storm', place: 'Wolfmere' }), { arrivesAt: DAY + 10 * DAY, via: 'tier', days: 10 });
    // Glassdock → Wolfmere: the river is class river (60 km a day; its hours are a sea lane's field only) 440 km, then 180 km of road.
    const coast = at(state, { name: 'Coast Fire', place: 'Wolfmere' });
    assert.deepEqual([coast.arrivesAt, coast.via, coast.km], [DAY + Math.ceil((440 / 60 + 3) * DAY), 'route', 620]);
    assert.equal(at(state, { name: 'Nowhere News', place: 'Wolfmere' }).arrivesAt, DAY, 'an entry with no place is heard at once');
    // A route whose kind maps to no class (a pack before route kinds) goes at the reader's courier pace.
    const unclassed = { ...PACK, routes: PACK.routes.map(route => (route.kind === 'road' ? { ...route, kind: 'cart track' } : route)) };
    assert.equal(at(state, { name: 'Border War', place: 'Wolfmere', kmPerDay: 30, pack: unclassed }).days, 2);
    assert.equal(at(state, { name: 'Border War', place: 'Wolfmere', on: false }), null);
    assert.equal(newsAt(state, { entryId: 'nope', place: 'Wolfmere' }, hostFor(state)), null);
});

test('world.heardHere (a world line\'s entries): heard at once, fact at their own place, rumour elsewhere until the courier time (spec §4)', () => {
    const tags = (state, options = {}) => Object.fromEntries(heardHere(state, options, hostFor(state)).map(entry => [entry.name, entry.tag]));
    const early = worldAt({ events: EVENTS, day: 1 });
    assert.deepEqual(tags(early), { 'Border War': 'rumour', 'Coast Fire': 'rumour', 'Far Storm': 'rumour', 'Local Row': 'fact', 'Nowhere News': 'fact' });
    const day3 = worldAt({ events: EVENTS, day: 3 });
    assert.equal(tags(day3)['Border War'], 'fact', 'the courier came on day 2');
    assert.equal(tags(day3)['Far Storm'], 'rumour');
    const day12 = worldAt({ events: EVENTS, day: 12 });
    assert.deepEqual(Object.values(tags(day12)), ['fact', 'fact', 'fact', 'fact', 'fact']);
    // Asked about another place: at Far Keep its own storm is fact at once.
    assert.equal(tags(early, { place: 'Far Keep' })['Far Storm'], 'fact');
    // The arrival minute is fact; a minute before is still rumour.
    assert.equal(tags(early, { now: 2 * DAY - 1 })['Border War'], 'rumour');
    assert.equal(tags(early, { now: 2 * DAY })['Border War'], 'fact');
    assert.equal(heardHere(early, {}, hostFor(early, { on: false })), null);
});

test('the narrator\'s [World] tail is the same bytes whatever the switch (with it on the world note takes its place, hooks.js)', () => {
    for (const day of [1, 3, 8, 11]) {
        const state = worldAt({ events: EVENTS, day });
        assert.deepEqual(chronicleTail(viewFor(state)), chronicleTail({ ...viewFor(state), feature: undefined }));
        assert.deepEqual(chronicleTail(viewFor(state, { on: false })), chronicleTail({ ...viewFor(state), feature: undefined }));
    }
});

test('the Journal\'s news (a world line\'s entries): all heard at once with the switch on, as with it off; derived, nothing stored', () => {
    const early = worldAt({ events: EVENTS, day: 1 });
    const news = state => knownNews(state, hostFor(state)).map(item => item.name).sort();
    assert.deepEqual(news(early), ['Border War', 'Coast Fire', 'Far Storm', 'Local Row', 'Nowhere News']);
    assert.deepEqual(knownNews(early, hostFor(early, { on: false })).map(item => item.name).sort(), news(early));
    assert.deepEqual(news(worldAt({ events: EVENTS, day: 3 })), news(early));
});
