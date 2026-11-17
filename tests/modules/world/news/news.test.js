// News arrival (feature `story-director.world-events`): the courier's time over the routes, tiers where no route joins the places,
// world.newsAt / world.heardHere, the narrator's [World] tail and the Journal's news. All derived: the same state gives the same answer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { chronicleTail } from '../../../../modules/world/chronicle/note.js';
import { knownNews } from '../../../../modules/world/world/known.js';
import { courierDays } from '../../../../modules/atlas/atlas/courier.js';
import { heardHere, newsAt } from '../../../../modules/world/world/news.js';
import { DAY, hostFor, viewFor, worldAt } from './helpers.js';

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

test('world.newsAt: route time from the entry\'s start, tiers where no route joins, null with the switch off', () => {
    const state = worldAt({ events: EVENTS, day: 1 });
    // Hollin → Wolfmere: 60 km at 60 a day = 1 day, from the entry's start (day 1, minute 1440).
    assert.deepEqual(at(state, { name: 'Border War', place: 'Wolfmere' }), { arrivesAt: DAY + DAY, via: 'route', km: 60, days: 1 });
    assert.deepEqual(at(state, { name: 'Border War', place: 'Wolfmere', kmPerDay: 30 }), { arrivesAt: DAY + 2 * DAY, via: 'route', km: 60, days: 2 });
    assert.deepEqual(at(state, { name: 'Local Row', place: 'Wolfmere — Gate' }), { arrivesAt: DAY, via: 'tier', days: 0 });
    // Far Keep has no road: another region than Wolfmere, so the far tier (10 days); Glassdock reaches Wolfmere by road + river (7 days).
    assert.deepEqual(at(state, { name: 'Far Storm', place: 'Wolfmere' }), { arrivesAt: DAY + 10 * DAY, via: 'tier', days: 10 });
    assert.deepEqual(at(state, { name: 'Coast Fire', place: 'Wolfmere' }), { arrivesAt: DAY + 7 * DAY, via: 'route', km: 620, days: 7 });
    assert.equal(at(state, { name: 'Nowhere News', place: 'Wolfmere' }).arrivesAt, DAY, 'an entry with no place is heard at once');
    assert.equal(at(state, { name: 'Border War', place: 'Wolfmere', on: false }), null);
    assert.equal(newsAt(state, { entryId: 'nope', place: 'Wolfmere' }, hostFor(state)), null);
});

test('world.heardHere: only entries whose news has reached the place by now; the scene and the clock are the defaults', () => {
    const early = worldAt({ events: EVENTS, day: 1 });
    assert.deepEqual(ids(heardHere(early, {}, hostFor(early)), early), ['Local Row', 'Nowhere News']);
    const day3 = worldAt({ events: EVENTS, day: 3 });
    assert.deepEqual(ids(heardHere(day3, {}, hostFor(day3)), day3), ['Border War', 'Local Row', 'Nowhere News']);
    const day8 = worldAt({ events: EVENTS, day: 8 });
    assert.deepEqual(ids(heardHere(day8, {}, hostFor(day8)), day8), ['Border War', 'Coast Fire', 'Local Row', 'Nowhere News']);
    const day11 = worldAt({ events: EVENTS, day: 11 });
    assert.equal(heardHere(day11, {}, hostFor(day11)).length, 5);
    // Asked about another place: from Far Keep everything but its own is far, Far Storm is heard at once.
    assert.deepEqual(ids(heardHere(early, { place: 'Far Keep' }, hostFor(early)), early), ['Far Storm', 'Nowhere News']);
    // The same minute at the arrival is heard; a minute before is not.
    assert.equal(heardHere(early, { now: 2 * DAY - 1 }, hostFor(early)).some(entry => entry.arrivesAt === 2 * DAY), false);
    assert.equal(heardHere(early, { now: 2 * DAY }, hostFor(early)).some(entry => entry.arrivesAt === 2 * DAY), true);
    assert.equal(heardHere(early, {}, hostFor(early, { on: false })), null);
});

test('the narrator\'s tail: entries not yet heard are left out with the switch on; with it off the tail is as it was', () => {
    const names = view => chronicleTail(view).lines.slice(1).map(text => /^- ([^(:.]+?)(?: \(|:|\.)/.exec(text)[1]);
    for (const day of [1, 3, 8, 11]) {
        const state = worldAt({ events: EVENTS, day });
        const off = names(viewFor(state, { on: false }));
        assert.equal(off.length, 3, 'off: the pick of three, whatever the switch');
        assert.deepEqual(chronicleTail(viewFor(state, { on: false })), chronicleTail({ ...viewFor(state), feature: undefined }), 'off is the same bytes as a host without the switch');
        const heard = new Set(heardHere(state, {}, hostFor(state)).map(entry => entry.name));
        assert.deepEqual(names(viewFor(state)), off.filter(name => heard.has(name)), `day ${day}: the same pick, minus what has not arrived`);
    }
    const early = worldAt({ events: EVENTS, day: 1 });
    assert.equal(names(viewFor(early)).includes('Far Storm'), false);
    assert.equal(names(viewFor(early)).includes('Border War'), false);
    assert.equal(names(viewFor(worldAt({ events: EVENTS, day: 11 }))).length, 3, 'once it has all arrived the full pick is back');
});

test('the Journal\'s news holds only what has reached the scene\'s place; a rewound clock hides it again (derived, nothing stored)', () => {
    const early = worldAt({ events: EVENTS, day: 1 });
    const news = state => knownNews(state, hostFor(state)).map(item => item.name).sort();
    assert.deepEqual(news(early), ['Local Row', 'Nowhere News']);
    assert.deepEqual(knownNews(early, hostFor(early, { on: false })).map(item => item.name).sort(), ['Border War', 'Coast Fire', 'Far Storm', 'Local Row', 'Nowhere News']);
    const later = worldAt({ events: EVENTS, day: 3 });
    assert.deepEqual(news(later), ['Border War', 'Local Row', 'Nowhere News']);
    // A rebuilt state (reload, replay) at the same clock gives the same answer; the clock back (rewind, swipe) gives the earlier one.
    assert.deepEqual(news(worldAt({ events: EVENTS, day: 3 })), news(later));
    assert.deepEqual(news(worldAt({ events: EVENTS, day: 1 })), news(early));
    // Moving the scene moves the arrival: at Hollin the Border War is local, Wolfmere's row is a day off.
    const hollin = worldAt({ events: EVENTS, day: 1, at: 'Hollin' });
    assert.deepEqual(news(hollin), ['Border War', 'Nowhere News']);
});
