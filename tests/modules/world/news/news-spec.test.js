// WEALIGN, news to spec §4 (and §1 route classes, §2 route effects): the world's happenings (the daily step's entries, `by:
// event:world.<id>`) travel by courier at route-class speeds, stop at their reach, end as news of their own, are never heard before
// the courier, and name a hidden place's region. Acceptance tests 30, 42 (news part), 48, 69 (courier part), 72 (news part), 73.
import test from 'node:test';
import assert from 'node:assert/strict';

import { knownNews } from '../../../../modules/world/world/known.js';
import { heardHere, newsAt } from '../../../../modules/world/world/news.js';
import { shownPlace } from '../../../../modules/world/world/news-reach.js';
import { DAY, hostFor } from './helpers.js';
import { clockAt, makeState, sceneAt } from '../chronicle/helpers/fake-ctx.js';

const HOUR = 60;
const PACK = {
    realms: [{ id: 'march-realm', name: 'The March Realm', regions: ['March', 'Peaks'] }, { id: 'sea-realm', name: 'Sea Realm', regions: ['Coast'] }],
    // packs.content answers a list (one map per pack), as the host does.
    placeKinds: [{ fort: 'outpost', dungeon: 'none' }],
    routeKinds: [{
        'bastion road': 'relay-road', road: 'road', 'hidden path': 'trail', river: 'river', 'sea lane': 'sea', 'deep-sea lane': 'sea',
        'mountain road': 'pass', 'air route': 'none', expedition: 'none', 'dungeon access': 'none',
    }],
    places: [
        { name: 'Ledgerford', region: 'March', kind: 'town', x: 0, y: 0 }, { name: 'Highmark', region: 'March', kind: 'town', x: 1, y: 0 },
        { name: 'Riverby', region: 'March', kind: 'town', x: 2, y: 0 }, { name: 'Trailend', region: 'March', kind: 'town', x: 3, y: 0 },
        { name: 'Seagate', region: 'Coast', kind: 'town', x: 4, y: 0 }, { name: 'Far Isle', region: 'Coast', kind: 'town', x: 5, y: 0 },
        { name: 'Windcutter', region: 'Peaks', kind: 'fort', x: 6, y: 0 }, { name: 'Northledger Depot', region: 'March', kind: 'fort', x: 7, y: 0 },
        { name: 'Old Mine', region: 'March', kind: 'dungeon', x: 8, y: 0 }, { name: 'Skyrest', region: 'Peaks', kind: 'town', x: 9, y: 0 },
        { name: 'Hidden Vale', region: 'March', kind: 'town', x: 10, y: 0, hidden: true },
    ],
    routes: [
        { from: 'Ledgerford', to: 'Highmark', kind: 'bastion road', km: 270 },
        { from: 'Ledgerford', to: 'Riverby', kind: 'river', km: 90, hours: 10 },
        { from: 'Ledgerford', to: 'Trailend', kind: 'hidden path', km: 70 },
        { from: 'Ledgerford', to: 'Seagate', kind: 'sea lane', km: 500, hours: 36 },
        { from: 'Seagate', to: 'Far Isle', kind: 'deep-sea lane', km: 220 },
        { from: 'Highmark', to: 'Windcutter', kind: 'mountain road', km: 120 },
        { from: 'Ledgerford', to: 'Old Mine', kind: 'dungeon access', km: 5 },
        { from: 'Ledgerford', to: 'Skyrest', kind: 'air route', km: 50 },
        { from: 'Ledgerford', to: 'Northledger Depot', kind: 'river', km: 120, name: 'ledgerford-river' },
        { from: 'Ledgerford', to: 'Northledger Depot', kind: 'bastion road', km: 135, name: 'ledgerford-bastion' },
        { from: 'Ledgerford', to: 'Hidden Vale', kind: 'road', km: 60 },
    ],
    conditions: [
        { name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.', effects: { routes: 'blocked' } },
        { name: 'pass-shut', scope: 'route', fades: 'until cleared', means: 'Snow.', effects: { routes: '×0 speed' } },
        { name: 'mud', scope: 'route', fades: '10 days', means: 'Slow going.', effects: { routes: '×0.5 speed' } },
        { name: 'fallen', scope: 'place', fades: 'until cleared', means: 'Fallen.', placeStatus: true },
    ],
};
const FIRED = 10 * DAY + 8 * HOUR;
// A world happening as the daily step writes it, at Ledgerford, fired on day 10 at 08:00 (the test's minute; the step dates the start of the day).
function world({ day = 10, at = 'Highmark', reach = 'regional', place = 'Ledgerford', ended = null, conditions = {} } = {}) {
    const state = structuredClone(sceneAt(clockAt(makeState({ minutes: day * DAY }), day * DAY + 8 * HOUR), at));
    state.domains.chronicle.events.ev_w0000001 = {
        id: 'ev_w0000001', name: 'The Levy · day 10', summary: 'The lords call the levy.', state: ended ? 'resolved' : 'ongoing', since: FIRED, updated: ended ?? FIRED,
        place, factions: [], aka: [], rev: 1, by: 'event:world.levy', reach,
    };
    state.domains.chronicle.conditions = Object.fromEntries(Object.entries(conditions).map(([key, scope]) => {
        const [name, ref] = key.split('@');
        return [key, { name, scope, ref, since: 0, fadesAt: null, why: '', by: 'code', rev: 0 }];
    }));
    return state;
}
const tools = state => hostFor(state, { pack: PACK });
const arrive = (state, place) => newsAt(state, { entryId: 'ev_w0000001', place }, tools(state));
const days = (state, place) => { const out = arrive(state, place); return out ? (out.arrivesAt - FIRED) / DAY : null; };

test('test 48: route class speeds — relay-road 135, road 60, trail 35, river 60 (its hours ignored), sea by hours or km at 110, pass as a road, none never', () => {
    const s = world({ reach: 'world' });
    assert.deepEqual([days(s, 'Highmark'), days(s, 'Riverby'), days(s, 'Trailend'), days(s, 'Seagate'), days(s, 'Far Isle'), days(s, 'Windcutter')], [2, 1.5, 2, 1.5, 3.5, 4]);
    assert.equal(arrive(s, 'Highmark').via, 'route');
    // Class none: the dungeon access and the air route are never used; reach steps instead (same region 1 day, same realm 4).
    assert.deepEqual([arrive(s, 'Old Mine').via, days(s, 'Old Mine'), days(s, 'Skyrest')], ['tier', 1, 4]);
});

test('test 30: news with reach — fired on day 10 at 08:00 at P, regional; a relay road of 270 km is day 12 at 08:00, a river of 90 km day 11 at 20:00; another region gets none; the end is news of its own', () => {
    // SPEC-CONFLICT: test 30 calls P–Q "a road" at 135 km/day; 135 is the relay-road speed (test 48, spec §1), so the route is a relay road here.
    const s = world();
    assert.equal(arrive(s, 'Highmark').arrivesAt, 12 * DAY + 8 * HOUR);
    assert.equal(arrive(s, 'Riverby').arrivesAt, 11 * DAY + 20 * HOUR);
    assert.equal(arrive(s, 'Seagate'), null, 'Coast is another region: the news stops at its reach');
    assert.equal(heardHere(world({ day: 30, at: 'Seagate' }), {}, tools(world({ day: 30, at: 'Seagate' }))).length, 0);
    const heard = (day, minutes = 8 * HOUR) => { const st = world({ day, ended: 15 * DAY + 8 * HOUR }); return heardHere(st, { now: day * DAY + minutes }, tools(st)); };
    assert.deepEqual(heard(11).map(entry => entry.name), [], 'day 11 at Highmark: not yet');
    assert.deepEqual(heard(12).map(entry => [entry.tag, entry.news, entry.state]), [['fact', 'fired', 'ongoing']], 'day 12: fact, and still under way as heard here');
    assert.deepEqual(heard(16).map(entry => [entry.news, entry.state]), [['fired', 'ongoing']], 'ended on day 15, that news is 2 days off');
    assert.deepEqual(heard(17).map(entry => [entry.news, entry.state]), [['ended', 'resolved']], 'day 17 at 08:00: the end heard, the same courier time');
    const ended = world({ ended: 15 * DAY + 8 * HOUR });
    assert.equal(newsAt(ended, { entryId: 'ev_w0000001', place: 'Highmark' }, tools(ended)).endsAt, 17 * DAY + 8 * HOUR);
    for (const [reach, place, reached] of [['local', 'Riverby', false], ['local', 'Ledgerford', true], ['realm', 'Windcutter', true], ['realm', 'Seagate', false], ['world', 'Seagate', true]]) {
        assert.equal(arrive(world({ reach }), place) !== null, reached, `${reach} at ${place}`);
    }
});

test('tests 42, 15 and 72 (news): a blocked route is not used, a slowed one takes longer, a fallen end doubles it, and the multipliers multiply; a closure names one route', () => {
    const s = conditions => world({ reach: 'world', conditions });
    assert.equal(days(s({}), 'Northledger Depot'), 1, 'the bastion road (135 km, relay) first');
    assert.equal(days(s({ 'roads-closed@ledgerford-bastion': 'route' }), 'Northledger Depot'), 2, 'test 72: only the bastion road closes; the river (120 km at 60) is used');
    assert.equal(days(s({ 'roads-closed@ledgerford-bastion': 'route', 'mud@ledgerford-river': 'route' }), 'Northledger Depot'), 4, '×0.5 speed doubles the time');
    assert.equal(days(s({ 'roads-closed@ledgerford-bastion': 'route', 'mud@ledgerford-river': 'route', 'fallen@Northledger Depot': 'place' }), 'Northledger Depot'), 8, 'a fallen end ×2 on top (test 15: routes through it cost double)');
    assert.equal(days(s({ 'fallen@Northledger Depot': 'place' }), 'Northledger Depot'), 2);
    const both = s({ 'roads-closed@ledgerford-bastion': 'route', 'roads-closed@ledgerford-river': 'route' });
    assert.deepEqual([arrive(both, 'Northledger Depot').via, days(both, 'Northledger Depot')], ['tier', 1], 'no courier route left: the reach step');
});

test('test 69 (courier part): a mountain road is a pass that a closing condition blocks; air routes, expeditions and dungeon access never carry news', () => {
    const open = world({ reach: 'world' });
    assert.equal(days(open, 'Windcutter'), 4);
    const shut = world({ reach: 'world', conditions: { 'pass-shut@Highmark-Windcutter': 'route' } });
    assert.deepEqual([arrive(shut, 'Windcutter').via, days(shut, 'Windcutter')], ['tier', 4], 'the pass is shut: the realm step');
});

test('test 73 (news): news from an undiscovered hidden place names its region; once the atlas shows the place, its own name', () => {
    const s = world({ reach: 'world', place: 'Hidden Vale', day: 20 });
    const [entry] = heardHere(s, {}, tools(s));
    assert.equal(entry.place, 'March');
    const origin = { name: 'Hidden Vale', region: 'March', hidden: true };
    assert.equal(shownPlace(origin, { query: () => [{ name: 'Hidden Vale' }] }, 'Hidden Vale'), 'Hidden Vale', 'discovered');
    assert.equal(shownPlace({ ...origin, hidden: false }, { query: () => [] }, 'Hidden Vale'), 'Hidden Vale');
});

test('rumour vs fact: a world happening is never heard before its courier and is fact when it comes; the News card shows when and how it came (E36)', () => {
    const before = world({ day: 11 });
    assert.deepEqual(heardHere(before, {}, tools(before)), []);
    assert.deepEqual(knownNews(before, tools(before)).map(item => item.name), []);
    const after = world({ day: 13 });
    const [item] = knownNews(after, tools(after));
    assert.equal(item.name, 'The Levy · day 10');
    assert.deepEqual(item.heard.at(-1), { where: 'in Highmark', when: '', from: 'a courier' });
    // With the switch off the same state shows the entry as any other (no arrival, no stamp).
    const off = knownNews(before, hostFor(before, { pack: PACK, on: false }));
    assert.deepEqual([off.length, off[0].heard], [1, []]);
});
