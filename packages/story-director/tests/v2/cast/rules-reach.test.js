import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAdvance, applyJourney } from '../../../src/v2/cast/apply.js';
import { validateCast } from '../../../src/v2/cast/domain.js';
import { atParty, partyPlace } from '../../../src/v2/cast/entries.js';
import { atPlace, canBeHere, canReach, chanceCandidates, chooseMeetings, daysBetween, linkOf, movable, moveFits, moveReach, paceOf, reachDays, sortComes } from '../../../src/v2/cast/world.js';
import { packWorld, worldOf } from '../../../src/v2/atlas/world.js';
import { travelTime } from '../../../src/v2/atlas/travel.js';
import { BLUEWATCH, DAY, ERSVEIL, GUILD, HOUR, LINKED_TAPROOM, LOCATED_GUILD, LOCATED_TAPROOM, REPLY14, RUN_ATLAS, RUN_PACK, START, TAPROOM, anyTrip, atlasOf, farWorld, keysOf, linked, located, named, partyOf, queryOver, roadTrip, runCast, runTrip, travel } from './rules.helpers.js';
test('reach: the same area is no distance; a route needs the story time since they were placed; no route is far', () => {
    const { slice } = farWorld();
    const rika = slice.people['ersveil:rika'];
    const days = daysBetween(rika.where, BLUEWATCH, travel);
    assert.ok(days > 10, `Auvoth to Bluewatch is a long trip (${days} days)`);
    assert.equal(daysBetween('Bluewatch Village', BLUEWATCH, travel), 0);
    assert.equal(daysBetween('Shackles City / Chainmarket', BLUEWATCH, travel), null, 'no route: unknown');
    assert.equal(canBeHere(rika, BLUEWATCH, { now: START, travel }), false, 'reply 4: nothing has passed');
    assert.equal(canBeHere(rika, BLUEWATCH, { now: START + Math.ceil(days * DAY) - 1, travel }), false);
    assert.equal(canBeHere(rika, BLUEWATCH, { now: START + Math.ceil(days * DAY), travel }), true, 'enough time has passed');
    assert.equal(canBeHere({ where: 'Shackles City', since: START }, BLUEWATCH, { now: START + 400 * DAY, travel }), false, 'unknown distance is far however long');
});

test('chance meeting: only people who can be here (the export: Rika at reply 4 is not chanced upon; a neighbour is; time lets her)', () => {
    const { slice, cast } = farWorld();
    const at = now => keysOf(chanceCandidates(slice, cast, { party: BLUEWATCH, now, travel }));
    assert.deepEqual(at(START), ['temiwa'], 'the neighbour only');
    assert.equal(chanceCandidates(slice, cast, { party: BLUEWATCH, now: START, travel })[0].here, true);
    assert.deepEqual(at(START + 30 * DAY), ['rika', 'temiwa'], 'thirty days later Rika can be here; Ysmeth (no route) never');
    assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: BLUEWATCH, now: START + 30 * DAY, travel, pace: { count: 0, days: 1 } })), [], 'the pace is full');
});

test('a goal: a real link (the place, a thread naming them or what they follow, something carried) and never a shared word; far means a journey, near a meeting', () => {
    const { slice, cast } = farWorld();
    const item = key => movable(slice, cast).find(entryItem => entryItem.key === key);
    assert.equal(linkOf(item('ersveil:ysmeth'), BLUEWATCH, { threads: [{ key: 'The Grey Ledger audit', fields: { giver: 'Grey Ledger clerk', people: 'Ledger men' } }], items: ['Ledger of debts'] }), '', 'the owner\'s Ysmeth: "Ledger" in her goal and in the story is no link');
    assert.equal(linkOf(item('ersveil:rika'), BLUEWATCH, { threads: [{ key: 'Guild contract', fields: { giver: 'Guild Office' } }], items: [] }), '', 'a bare "Guild" is none either');
    assert.equal(linkOf(item('ersveil:rika'), BLUEWATCH, named('Rika')), 'thread');
    assert.equal(linkOf(item('ersveil:ysmeth'), BLUEWATCH, named('the River Council')), 'thread', 'their faction as giver');
    assert.equal(linkOf(item('ersveil:ysmeth'), { place: 'The Broken Chain', region: '' }, {}), 'place', 'the place is their goal\'s');
    assert.equal(linkOf(item('ersveil:rika'), BLUEWATCH, { items: ['Church Inquest agents'] }), 'carried');
    const comes = key => [{ key, reason: 'it pulls her' }];
    const run = (key, links, now = START) => sortComes(slice, cast, { comes: comes(key), party: BLUEWATCH, now, travel, links });
    // The export's case: reply 4, Rika far, no meeting; a journey instead (landing after the real trip).
    const far = run('ersveil:rika', named('Rika'));
    assert.deepEqual([far.meet.length, far.start.length], [0, 1]);
    assert.equal(far.start[0].arrive, START + Math.ceil(daysBetween('Auvoth / Pale Market', BLUEWATCH, travel) * DAY));
    assert.deepEqual(run('ersveil:rika', named('Guild Office')), { meet: [], start: [], stop: [], land: [] }, 'no link: nothing, not even a journey');
    assert.deepEqual(run('ersveil:ysmeth', named('Ysmeth')), { meet: [], start: [], stop: [], land: [] }, 'Ysmeth: linked but no route: far, no time to give');
    assert.equal(run('ersveil:rika', named('Rika'), START + 30 * DAY).meet.length, 1, 'enough time: she arrives');
    assert.equal(sortComes(slice, cast, { comes: comes('ersveil:temiwa'), party: BLUEWATCH, now: START, travel, links: { items: ['the Ashen Veil'] } }).meet.length, 1, 'a neighbour still meets');
});

test('a journey: set out, landing after the trip at the place the party was, dropped when the link goes; the slot is valid', () => {
    const { slice, cast } = farWorld();
    const sorted = sortComes(slice, cast, { comes: [{ key: 'ersveil:rika', reason: 'her licence' }], party: BLUEWATCH, now: START, travel, links: named('Rika') });
    assert.deepEqual(applyJourney(slice, { start: sorted.start }, { now: START, rev: 2 }), { started: 1, stopped: 0, landed: 0 });
    assert.deepEqual(validateCast(slice), []);
    assert.equal(slice.people['ersveil:rika'].where, 'Auvoth / Pale Market', 'still where she was while on the road');
    const trip = slice.people['ersveil:rika'].coming[0];
    const again = sortComes(slice, cast, { comes: [], party: BLUEWATCH, now: trip.arrive - 1, travel, links: named('Rika') });
    assert.deepEqual([again.stop, again.land], [[], []], 'on the road');
    assert.deepEqual(sortComes(slice, cast, { comes: [], party: BLUEWATCH, now: trip.arrive - 1, travel, links: {} }).stop, ['ersveil:rika'], 'the reason went away: cancelled');
    const landed = sortComes(slice, cast, { comes: [], party: BLUEWATCH, now: trip.arrive, travel, links: named('Rika') });
    applyJourney(slice, { land: landed.land }, { now: trip.arrive, rev: 3 });
    assert.deepEqual([slice.people['ersveil:rika'].where, slice.people['ersveil:rika'].since, slice.people['ersveil:rika'].coming], [BLUEWATCH.place, trip.arrive, null]);
    assert.equal(atParty(slice.people['ersveil:rika'].where, BLUEWATCH), true, 'now she meets the party by place');
    assert.deepEqual(validateCast(slice), []);
});

test('planner moves: a trip that does not fit the time since they were placed is refused; no route is refused only onto the party\'s place', () => {
    const { slice } = farWorld();
    const rika = slice.people['ersveil:rika'];
    const fit = (where, to) => moveFits(rika, where, { party: BLUEWATCH, to, travel });
    assert.equal(fit('Bluewatch Village', START + DAY), false, 'an 18-day trip in a day');
    assert.equal(fit('Bluewatch Village', START + 40 * DAY), true);
    assert.equal(fit('Marsh Road', START + DAY), true, 'no route, not the party\'s place');
    assert.equal(fit('Bluewatch Village / Guild Office', START + DAY), false);
    assert.equal(moveFits({ where: '' }, 'Bluewatch Village', { party: BLUEWATCH, to: START, travel }), true, 'unplaced');
});

test('reach, rule 2: run5cast reply 14, Rika (Auvoth / Pale Market) is not chanced upon in Drowned Bell taproom 1730 minutes in; rule 1 took her by a straight-line estimate', () => {
    const { slice, cast } = runCast();
    const rika = slice.people['ersveil:rika'];
    // Why rule 1 passed: the taproom has no road and no town, so the atlas estimated the trip from map coordinates at one km a unit.
    const estimate = runTrip('Auvoth / Pale Market', 'Drowned Bell taproom');
    assert.equal(estimate.source, 'map');
    assert.ok(estimate.days * DAY <= REPLY14 - START, `half a day by the straight line (${estimate.days} days) fits the 1730 minutes`);
    assert.equal(canBeHere(rika, TAPROOM, { now: REPLY14, travel: anyTrip }), true, 'rule 1 (steps with reach: 1 replay as they were)');
    assert.ok(keysOf(chanceCandidates(slice, cast, { party: TAPROOM, now: REPLY14, travel: anyTrip })).includes('rika'), 'rule 1 would chance on her');
    // Rule 2: road trips only; the taproom has none, so she is far.
    assert.equal(reachDays(rika.where, TAPROOM, roadTrip), null);
    assert.equal(canReach(rika, TAPROOM, { now: REPLY14, travel: roadTrip }), false);
    for (const now of [REPLY14, START + 400 * DAY]) assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: TAPROOM, now, travel: roadTrip, strict: true })), [], 'nobody far is chanced upon, nor Torka (no road to the taproom, and it is not his village by name)');
    // The frontier road: 70 km, 3.5 days; at the guild office she can be there only once the road's time has passed since she was placed.
    const days = reachDays(rika.where, GUILD, roadTrip);
    assert.ok(days >= 3.5, `the road is at least 3.5 days (${days})`);
    assert.equal(canReach(rika, GUILD, { now: REPLY14, travel: roadTrip }), false, 'reply 14 at the guild office: still too soon');
    assert.equal(canReach(rika, GUILD, { now: START + Math.ceil(days * DAY) - 1, travel: roadTrip }), false);
    assert.equal(canReach(rika, GUILD, { now: START + Math.ceil(days * DAY), travel: roadTrip }), true);
    assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: GUILD, now: REPLY14, travel: roadTrip, strict: true })), ['torka'], 'Torka, in the village, can be');
    // A goal pull that is linked sets out instead, landing after the road's time.
    const sorted = sortComes(slice, cast, { comes: [{ key: 'ersveil:rika', reason: 'her licence' }], party: TAPROOM, now: REPLY14, travel: roadTrip, links: named('Rika') });
    assert.deepEqual([sorted.meet, sorted.start], [[], []], 'to the taproom no road says how long: no meeting, no journey');
    const toGuild = sortComes(slice, cast, { comes: [{ key: 'ersveil:rika', reason: 'her licence' }], party: GUILD, now: REPLY14, travel: roadTrip, links: named('Rika') });
    assert.deepEqual([toGuild.meet.length, toGuild.start.length], [0, 1]);
    assert.ok(toGuild.start[0].arrive >= REPLY14 + Math.ceil(days * DAY));
});

test('a place meeting needs the party at the place or its town, not in its region (run5cast reply 17: Torka met while the party was on the Old Rut-Line)', () => {
    const { slice, cast } = runCast();
    const ROAD = { place: 'Old Rut-Line', region: 'bluewatch', town: '' };
    const meet = party => keysOf(chooseMeetings(slice, cast, { now: START + 2 * DAY, party, pace: paceOf({}), travel: roadTrip }));
    assert.equal(atParty('Bluewatch Village', ROAD), true, 'rule 1 took the region for the place');
    assert.equal(atPlace('Bluewatch Village', ROAD), false);
    assert.deepEqual(meet(ROAD), [], 'on the road outside Bluewatch: not met');
    assert.deepEqual(meet(GUILD), ['torka'], 'in the village (its guild office)');
    assert.deepEqual(meet({ place: 'Bluewatch gatehouse', region: 'bluewatch', town: 'Bluewatch Village' }), ['torka'], 'a place the atlas has in the village');
    assert.deepEqual(meet({ place: 'Bluewatch Village', region: 'bluewatch', town: '' }), ['torka']);
    assert.equal(atPlace('Auvoth / Pale Market', { place: 'Auvoth outskirts', region: 'auvoth', town: '' }), true, 'the same town (run5cast reply 21: Rika met in Auvoth)');
    assert.equal(atPlace('Bluewatch Village / Guild Office', { place: 'Glassdock / Guild Office', region: '', town: '' }), false, 'a guild office of another town');
    assert.equal(canReach(slice.people['ersveil:torka'], ROAD, { now: START + 2 * DAY, travel: roadTrip }), false, 'and not chanced upon there (no road says how far)');
});

test('planner moves, rule 2: no hop through a place with no road beats the road from the last known place; a road move ends that', () => {
    const { slice } = runCast();
    const rika = slice.people['ersveil:rika'];
    const reach = to => ({ party: GUILD, to, travel: roadTrip });
    const LAST = { where: 'Auvoth / Pale Market', since: START };
    assert.equal(moveReach(rika, 'Bluewatch Village', reach(START + DAY)), null, 'the road is 3.5 days');
    assert.equal(moveReach(rika, 'Bluewatch Village / Market', reach(START + DAY)), null, 'the party\'s town by its road, too soon');
    assert.equal(moveReach(rika, 'the river road north', reach(START + 6 * HOUR)).from.where, 'Auvoth / Pale Market', 'no road: kept, with her last known place');
    assert.equal(moveReach(rika, 'Bluewatch Village / Guild Office', { ...reach(START + 6 * HOUR), travel: () => null }), null, 'no road at all: never onto the party\'s place');
    // The two hops the review found: an unknown road first, then the party's town 12 hours after leaving a 3.5-day trip.
    const first = moveReach(rika, 'the river road north', reach(START + 6 * HOUR));
    applyAdvance(slice, { from: START, to: START + 6 * HOUR, moves: [{ key: 'ersveil:rika', where: 'the river road north', doing: 'walks', from: first.from }] }, { rev: 2 });
    assert.deepEqual([rika.where, rika.since, rika.known], ['the river road north', START + 6 * HOUR, [LAST]]);
    assert.deepEqual(validateCast(slice), []);
    assert.equal(moveReach(rika, 'Bluewatch Village / Market', reach(START + 12 * HOUR)), null, 'from her last known place it is still 3.5 days');
    assert.deepEqual(moveReach(rika, 'Wharf smithy', reach(START + 12 * HOUR)), { from: LAST }, 'another place with no road keeps the same last known place');
    assert.equal(canReach(rika, GUILD, { now: START + 12 * HOUR, travel: roadTrip }), false, 'not chanced upon either');
    assert.equal(canReach(rika, GUILD, { now: START + 4 * DAY, travel: roadTrip }), true, 'once the road from Auvoth could be walked');
    assert.deepEqual(moveReach(rika, 'Bluewatch Village', reach(START + 4 * DAY)), {}, 'the road fits: no last known place to keep');
    applyAdvance(slice, { from: START + 6 * HOUR, to: START + 4 * DAY, moves: [{ key: 'ersveil:rika', where: 'Bluewatch Village', doing: 'arrives' }] }, { rev: 3 });
    assert.deepEqual([rika.where, rika.known], ['Bluewatch Village', null]);
    assert.deepEqual(validateCast(slice), []);
    // At a place with no road, a place meeting waits for the road from her last known place too.
    slice.people['ersveil:rika'].known = [LAST];
    slice.people['ersveil:rika'].where = 'Drowned Bell taproom';
    const cast = runCast().cast;
    assert.deepEqual(keysOf(chooseMeetings(slice, cast, { now: START + DAY, party: TAPROOM, pace: paceOf({}), travel: roadTrip })), [], 'there, but not by any road in a day');
});

test('reach 3 (review BLOCK): a region whose name holds a town\'s is not that town ("Shornmarch" holds "Shorn"); nobody there is met faster than the road', () => {
    const pack = {
        places: [
            { name: 'Shorn', region: 'Shornmarch', kind: 'capital', x: 0, y: 0 },
            { name: 'Ashmere', region: 'Kingdom of Ashmere', kind: 'capital', x: 40, y: 0 },
            { name: 'Ashmere / Market', region: 'Kingdom of Ashmere', kind: 'district', x: 40, y: 0 },
            { name: 'Auvoth', region: 'Auvoth Compact', kind: 'city', x: 80, y: 0 },
            { name: 'Auvoth / Pale Market', region: 'Auvoth Compact', kind: 'district', x: 80, y: 0 },
        ],
        routes: [],
    };
    // Places the narrator made, which the atlas gave the scene's region (atlas/capture.js): no parent, no road.
    const query = queryOver(atlasOf([
        { name: 'Wayside inn', region: 'Shornmarch', kind: 'inn' },
        { name: 'Ferry house', region: 'Kingdom of Ashmere', kind: 'inn' },
        { name: 'Compact waystation', region: 'Auvoth Compact', kind: 'inn' },
    ]), pack);
    for (const [place, region, where] of [['Wayside inn', 'Shornmarch', 'Shorn'], ['Ferry house', 'Kingdom of Ashmere', 'Ashmere / Market'], ['Compact waystation', 'Auvoth Compact', 'Auvoth / Pale Market']]) {
        const party = located({ place, region, town: '', open: false }, query);
        assert.equal(atPlace(where, party), false, `${where} is not at ${place} (${region})`);
        assert.equal(reachDays(where, party, () => null), null, 'no road says how far');
        assert.equal(canReach({ where, since: START }, party, { now: START + 1, travel: () => null }), false, 'a minute after they were placed: far');
    }
    // A region names no town even when the atlas finds a place by it ("bluewatch" is Bluewatch Village's alias; castfix3c, REV-castfix3b): with no
    // parent saved, the taproom and a quay in "River Confederacy: Bluewatch" sit in no town, as in castfix2; a saved parent puts them in it.
    const quay = queryOver(atlasOf([{ name: 'Lantern quay', region: 'River Confederacy: Bluewatch', kind: 'quay' }], RUN_ATLAS), RUN_PACK);
    assert.equal(atPlace('Bluewatch Village', LOCATED_TAPROOM), false, 'region "bluewatch", no parent: not the village');
    assert.equal(atPlace('Bluewatch Village', located({ place: 'Lantern quay', region: 'River Confederacy: Bluewatch', town: '', open: false }, quay)), false);
    assert.equal(atPlace('Bluewatch Village', located(TAPROOM, queryOver(RUN_ATLAS, ERSVEIL))), false);
    assert.equal(atPlace('Bluewatch Village', LINKED_TAPROOM), true, 'the atlas\'s saved parent');
});

// Ersveil 2.9.6's own places and roads for REV-castfix3b's four cases: towns, a fort and a dungeon whose region has a pack place's name.
const VALEGARD_PACK = {
    places: [
        { name: 'Valegard', region: 'Valegard', kind: 'capital', x: 22, y: 56 },
        { name: 'Highmeadow', region: 'Valegard', kind: 'town', x: 27, y: 59 },
        { name: 'Rosefen', region: 'Valegard', kind: 'town', x: 15, y: 53 },
        { name: 'Shackles City', aliases: ['Shackles', 'Free City of Shackles'], region: 'Shackles', kind: 'city', x: -55, y: -5 },
        { name: 'Shackles City / Veil Market', aliases: ['Veil Market'], region: 'Shackles', kind: 'district', x: -54.9, y: -4.9 },
        { name: 'Dustbell', region: 'Shackles', kind: 'town', x: -56.2, y: -4.5 },
        { name: 'Westchain Hold', region: 'Shackles', kind: 'fort', x: -56.5, y: -5.2 },
        { name: 'Atlantis', region: 'Atlantis', kind: 'capital', x: 210, y: -40 },
        { name: 'Atlantis / Abyssal Gate', aliases: ['Abyssal Gate'], region: 'Atlantis', kind: 'district', x: 210.6, y: -40.5 },
        { name: 'Drowned Archive', region: 'Atlantis', kind: 'dungeon', x: 218, y: -48 },
    ],
    routes: [
        { from: 'Highmeadow', to: 'Valegard', kind: 'local road', km: 70 },
        { from: 'Rosefen', to: 'Valegard', kind: 'local road', km: 90 },
        { from: 'Dustbell', to: 'Shackles City', kind: 'caravan road', km: 15 },
        { from: 'Westchain Hold', to: 'Shackles City', kind: 'caravan road', km: 16 },
        { from: 'Shackles City / Veil Market', to: 'Shackles City', kind: 'street', km: 2 },
        { from: 'Atlantis / Abyssal Gate', to: 'Atlantis', kind: 'street', km: 9 },
        { from: 'Atlantis / Abyssal Gate', to: 'Drowned Archive', kind: 'dungeon access', km: 120 },
    ],
};

test('reach 3 (REV-castfix3b BLOCK): a pack place is never in the pack place its region names; days apart by road stay days apart', () => {
    const atlas = { places: {}, keys: {}, routes: {}, tripRest: true, focus: null };
    const query = queryOver(atlas, VALEGARD_PACK);
    const world = worldOf(structuredClone(atlas), packWorld((name, { kind } = {}) => (name === 'packs.content' ? structuredClone(VALEGARD_PACK[kind] ?? []) : undefined)));
    const road = (from, to) => { const trip = travelTime(world, from, to); return trip?.source === 'routes' ? trip.days : null; };
    const cases = [['Rosefen', 'Highmeadow'], ['Valegard', 'Highmeadow'], ['Westchain Hold', 'Dustbell'], ['Shackles City / Veil Market', 'Dustbell'], ['Drowned Archive', 'Atlantis']];
    for (const [where, place] of cases) {
        const party = located({ place, region: query('atlas.place', { name: place }).region, town: '', open: false }, query);
        assert.deepEqual(party.locate(place).up, [], `${place}: no saved parent, so in nothing (its region "${query('atlas.place', { name: place }).region}" is no link)`);
        assert.equal(atPlace(where, party), false, `${where} is not at ${place}`);
        const days = reachDays(where, party, road);
        assert.ok(days > 0, `${where} → ${place}: the road (${days} days)`);
        assert.equal(days, road(where, place) ?? road(party.locate(where).up[0]?.name, place), 'the road, nothing shorter');
        assert.equal(canReach({ where, since: START }, party, { now: START + 1, travel: road }), false, 'a minute after they were placed: far');
        assert.equal(canReach({ where, since: START }, party, { now: START + Math.ceil(days * DAY), travel: road }), true, 'at the road\'s time');
        assert.equal(moveReach({ where, since: START }, place, { party: located({ place: 'Elsewhere', region: '', town: '' }, query), to: START + 1, travel: road }), null, `a planner move ${where} → ${place} a minute in`);
    }
    assert.ok(reachDays('Rosefen', located({ place: 'Highmeadow', region: 'Valegard', town: '' }, query), road) >= 8, 'Rosefen–Valegard–Highmeadow');
    // A district written "Town / Spot" is still in its town (rule 2 as merged read it so), and the party in the town meets it.
    assert.equal(atPlace('Shackles City / Veil Market', located({ place: 'Shackles City', region: 'Shackles', town: '' }, query)), true);
    // A place the narrator made with region "Valegard" and no parent saved: in no town, as in castfix2; with the atlas's parent: in Valegard.
    const made = (parent) => queryOver(atlasOf([{ name: 'Valegard', region: 'Valegard', kind: 'capital' }, { name: 'Wayside inn', region: 'Valegard', kind: 'inn', ...parent }]), VALEGARD_PACK);
    assert.equal(atPlace('Valegard', located({ place: 'Wayside inn', region: 'Valegard', town: '' }, made({}))), false);
    assert.equal(atPlace('Valegard', located({ place: 'Wayside inn', region: 'Valegard', town: '' }, made({ parent: 'pl_t0' }))), true);
});

test('reach 3 (review 6): a place whose name holds a town\'s is that town only when the atlas parents it there; rule 2 as merged replays as it was', () => {
    const pack = { places: [{ name: 'Shorn', region: 'Shornmarch', kind: 'capital', x: 0, y: 0 }, { name: 'Bluewatch Village', aliases: ['Bluewatch'], region: 'bluewatch', kind: 'village', x: 50, y: 0 }], routes: [] };
    const query = queryOver(atlasOf([{ name: 'Shornmarch Outpost', region: 'Shornmarch', kind: 'outpost' }, { name: 'Bluewatch gatehouse', region: 'bluewatch', kind: 'gatehouse', parent: 'pl_t2' }, { name: 'Bluewatch Village', region: 'bluewatch', kind: 'village' }]), pack);
    const unsaved = queryOver(atlasOf([{ name: 'Bluewatch gatehouse', region: 'bluewatch', kind: 'gatehouse' }]), pack);
    const OUTPOST = { place: 'Shornmarch Outpost', region: 'Shornmarch', town: '' };
    assert.equal(atPlace('Shorn', located(OUTPOST, query)), false);
    assert.equal(atPlace('Shorn', { ...OUTPOST, old: true }), true, 'the merged rule took the name holding the town (steps with reach: 2 replay so)');
    assert.equal(atPlace('Bluewatch Village', located({ place: 'Bluewatch gatehouse', region: 'bluewatch', town: '' }, query)), true, 'the atlas saved the village as its parent');
    assert.equal(atPlace('Bluewatch gatehouse', located({ place: 'Bluewatch Village', region: 'bluewatch', town: '' }, unsaved)), false, 'no parent saved: a name starting with the town\'s is nothing');
});

test('town meetings, run5cast (reach 3): the taproom, the smithy and the guild back room are in Bluewatch Village when the atlas saved that parent; Rika still waits for the road', () => {
    const { slice, cast } = runCast();
    const now = START + 2 * DAY;
    const meet = party => keysOf(chooseMeetings(slice, cast, { now, party, pace: paceOf({}), travel: roadTrip }));
    for (const place of ['Drowned Bell taproom', 'Wharf smithy', 'Adventurers\' Guild back room']) {
        assert.deepEqual(meet(linked({ place, region: 'bluewatch', town: '', open: false })), ['torka'], `${place}: Torka, of the village, is met`);
        assert.deepEqual(meet(located({ place, region: 'bluewatch', town: '', open: false })), [], `${place}, as the run's atlas has it (no parent): nobody, as in castfix2`);
    }
    assert.equal(atPlace('Auvoth / Pale Market', LINKED_TAPROOM), false, 'another town is not');
    assert.deepEqual(meet(linked({ place: 'Old Rut-Line', region: 'bluewatch', town: '', open: true })), [], 'the road outside town is not the town');
    // Reply 14 (castfix2's case): she is not chanced upon in the taproom 1730 minutes in; Torka, in his town, can be.
    for (const at of [REPLY14, START + 3 * DAY]) assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: LINKED_TAPROOM, now: at, travel: roadTrip, strict: true })), ['torka']);
    for (const at of [REPLY14, START + 3 * DAY]) assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: LOCATED_TAPROOM, now: at, travel: roadTrip, strict: true })), []);
    assert.deepEqual(keysOf(chanceCandidates(slice, cast, { party: { ...LINKED_TAPROOM, open: true }, now, travel: roadTrip, strict: true })), []);
});

test('reach 3 (review 3): someone from another town reaches a place in town by the road to that town, and not sooner', () => {
    const { slice } = runCast();
    const rika = slice.people['ersveil:rika'];
    const days = reachDays(rika.where, LINKED_TAPROOM, roadTrip);
    assert.equal(days, reachDays(rika.where, GUILD, roadTrip), 'the frontier road to Bluewatch Village');
    assert.ok(days >= 3.5, `${days}`);
    assert.equal(canReach(rika, LINKED_TAPROOM, { now: REPLY14, travel: roadTrip }), false);
    assert.equal(canReach(rika, LINKED_TAPROOM, { now: START + 3 * DAY, travel: roadTrip }), false, 'not at 3 days');
    assert.equal(canReach(rika, LINKED_TAPROOM, { now: START + Math.ceil(days * DAY), travel: roadTrip }), true, 'at the road\'s time');
    assert.equal(reachDays(rika.where, LOCATED_TAPROOM, roadTrip), null, 'no parent saved: no road to the taproom, as in castfix2');
    assert.equal(canReach(rika, LOCATED_TAPROOM, { now: START + 30 * DAY, travel: roadTrip }), false);
    assert.equal(reachDays(rika.where, linked({ place: 'Old Rut-Line', region: 'bluewatch', town: '', open: true }), roadTrip), null, 'a road or wilderness: only its own roads');
});

test('planner moves (reach 3, review 2): a move within the town is no trip; a roadless move onto a place in the party\'s town is refused', () => {
    const { slice } = runCast();
    const torka = slice.people['ersveil:torka'];
    const rika = slice.people['ersveil:rika'];
    const BACK_ROOM = linked({ place: 'Adventurers\' Guild back room', region: 'bluewatch', town: '', open: false });
    const WHARF = linked({ place: 'Wharf smithy', region: 'bluewatch', town: '', open: false });
    assert.deepEqual(moveReach(torka, 'Wharf smithy', { party: linked(GUILD), to: START + DAY, travel: roadTrip }), {}, 'Bluewatch Village to its smithy: no last known place to keep');
    assert.deepEqual(moveReach(torka, 'Wharf smithy', { party: LOCATED_GUILD, to: START + DAY, travel: roadTrip }), { from: { where: 'Bluewatch Village', since: START } }, 'no parent saved: a roadless move, as in castfix2');
    applyAdvance(slice, { from: START, to: START + DAY, moves: [{ key: 'ersveil:torka', where: 'Wharf smithy', doing: 'works' }] }, { rev: 2 });
    assert.equal(canReach(torka, WHARF, { now: START + DAY + 1, travel: roadTrip }), true);
    torka.known = [{ where: 'Bluewatch Village', since: START }];
    assert.equal(canReach(torka, WHARF, { now: START + DAY + 1, travel: roadTrip }), true, 'a last known place in the same town');
    // Rika (Auvoth) to the taproom while the party is in the back room: the road to the town is 3.5 days; with no road at all, never onto the town.
    assert.equal(moveReach(rika, 'Drowned Bell taproom', { party: BACK_ROOM, to: START + DAY, travel: roadTrip }), null);
    assert.deepEqual(moveReach(rika, 'Drowned Bell taproom', { party: BACK_ROOM, to: START + 4 * DAY, travel: roadTrip }), {}, 'the road fits');
    assert.equal(moveReach(rika, 'Drowned Bell taproom', { party: BACK_ROOM, to: START + DAY, travel: () => null }), null);
    assert.equal(moveReach(rika, 'Drowned Bell taproom', { party: linked({ place: 'Glassdock', region: 'glassdock', town: '' }), to: START + DAY, travel: () => null }).from.where, 'Auvoth / Pale Market', 'away from the party: kept, with her last known place');
});

test('reach 3 (review 5): a road or wilderness meets the places in it, and its name with or without "the"; a road is not the town it leaves', () => {
    const pack = { places: [{ name: 'Greywood', region: 'north', kind: 'forest', x: 0, y: 0 }, { name: 'Bluewatch Village', aliases: ['Bluewatch'], region: 'bluewatch', kind: 'village', x: 50, y: 0 }], routes: [] };
    const query = queryOver(atlasOf([
        { name: 'Greywood / Hunter\'s Lodge', region: 'north', kind: 'lodge' },
        { name: 'Old Rut-Line', region: 'bluewatch', kind: 'wild' },
        { name: 'Bluewatch Village Road', region: 'bluewatch', kind: 'road' },
    ]), pack);
    const party = place => located(partyOf(query, place), query);
    assert.equal(atPlace('Greywood / Hunter\'s Lodge', party('Greywood')), true, 'in the forest');
    assert.equal(atPlace('Greywood', party('Greywood / Hunter\'s Lodge')), false, 'the forest is not the lodge');
    assert.equal(atPlace('The Old Rut-Line', party('Old Rut-Line')), true);
    assert.equal(atPlace('Bluewatch Village', party('Bluewatch Village Road')), false, 'the road is not the town');
    assert.equal(atPlace('Bluewatch Village Road', party('Bluewatch Village')), false, 'nor someone on it in the town');
    assert.equal(atPlace('Bluewatch Village', party('Bluewatch gate')), true, 'a place the atlas reads as in the town');
});

test('partyPlace reads the map\'s own kind: a road or wilderness is open; a kind with a settlement word is a town (review 4)', () => {
    const party = kind => partyPlace(name => (name === 'atlas.here' ? { name: 'Somewhere', line: 'Somewhere', kind: 'tavern', placeKind: kind, region: 'north' } : undefined), {});
    const { locate, ...rest } = party('wild');
    assert.equal(typeof locate, 'function');
    assert.deepEqual(rest, { place: 'Somewhere', region: 'north', town: '', open: true }, 'the map\'s kind, not the scene\'s');
    for (const kind of ['camp', 'field', 'crossroads', 'ruin', 'ruins', 'Forest', 'mountain pass']) assert.equal(party(kind).open, true, kind);
    for (const kind of ['forest village', 'mountain hold', 'hill fort', 'watch-fort', 'town', 'settlement', 'gate', 'port']) assert.equal(party(kind).open, false, kind);
});

test('reach 2 replays as it was: `old` (and a party with no atlas reader) reads the merged rule; reach 3 the atlas', () => {
    assert.equal(atPlace('Bluewatch Village', { ...LOCATED_TAPROOM, old: true }), false, 'rule 2 as merged: a region alone is not the town');
    assert.equal(atPlace('Bluewatch Village', TAPROOM), false, 'no atlas reader: the merged rule');
    assert.equal(atPlace('Bluewatch Village', LOCATED_TAPROOM), false, 'reach 3, no parent saved: as merged');
    assert.equal(atPlace('Bluewatch Village', LINKED_TAPROOM), true, 'reach 3, the atlas\'s saved parent');
    const wild = { place: 'River Bluff (Auvoth)', region: 'auvoth', town: 'Auvoth' };
    assert.equal(atPlace('Auvoth / Pale Market', { ...wild, old: true }), true, 'a parented wild place counted as the town');
    assert.equal(atPlace('Auvoth / Pale Market', located({ ...wild, open: true })), false);
    assert.equal(reachDays('Auvoth / Pale Market', located({ ...wild, open: true }), (from, to) => (to === 'Auvoth' ? 1 : null)), null, 'not the road to its parent town');
});
