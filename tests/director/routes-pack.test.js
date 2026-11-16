// Tests for src/routes.js: loading world packs, places, and paces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROUTE_CODES, MODES, loadWorldPack, packSummary, exitsFrom, findPlace, paceFor, legDays,
    shortestPath, planRoute,
} from '../../modules/atlas/routes.js';
import { FIXTURE, hopsText, pack, tinyPack } from './routes.helpers.js';

// ---------------------------------------------------------------------------------------
// Loading

test('the fixture loads cleanly and summarises its counts', () => {
    const result = loadWorldPack(FIXTURE);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(packSummary(result.pack), '19 places · 23 routes');
    assert.equal(result.pack.courierMultiplier, 2);
    assert.deepEqual(result.pack.rules.noLevee, ['Bluewatch Branch', 'Belis River']);
    assert.equal(result.pack.rules.roundUpTo, 0.5);
    assert.equal(result.pack.rules.restDayEvery, 6);
    assert.equal(result.pack.calendar.era, 'CY');
    // downstream_favorable becomes downstream; notes are dropped.
    assert.deepEqual(result.pack.paces.W, { boat: [30, 45], upstream: [20, 30], downstream: [50, 60] });
    assert.deepEqual(result.pack.paces.L, {});
});

test('a pack that contradicts its own map is warned about', () => {
    const places = { Mill: { x: 0, y: 0 }, Ford: { x: 3, y: -4 }, Keep: { x: 10, y: 0 } };
    const paces = { R: { foot: 20 } };
    const short = loadWorldPack({ scale_km_per_unit: 10, places, paces, edges: [{ a: 'Mill', b: 'Ford', km: 30, code: 'R', bearing: 'SE/NW' }] });
    assert.deepEqual(short.warnings, ['Mill – Ford is 30 km, but the places are 50 km apart in a straight line.']);
    const wrong = loadWorldPack({ places, paces, edges: [{ a: 'Mill', b: 'Ford', km: 60, code: 'R', bearing: 'E/W' }, { a: 'Mill', b: 'Keep', km: 120, code: 'R', bearing: 'ENE/WSW' }] });
    assert.deepEqual(wrong.warnings, ['Mill – Ford says Ford lies E of Mill, but the coordinates put it SE.'], 'ENE for due east is within a step');
    // Every bearing fits y growing south: one hint instead of a warning per road.
    const image = loadWorldPack({ places, paces, edges: [{ a: 'Mill', b: 'Ford', km: 60, code: 'R', bearing: 'NE/SW' }, { a: 'Ford', b: 'Keep', km: 90, code: 'R', bearing: 'SE' }] });
    assert.deepEqual(image.warnings, ['The roads\' bearings fit a map whose y grows southwards (an image): set Map & travel → North is to Down.']);
});

test('the object form and the normalized shape load too', () => {
    const fromObject = loadWorldPack(JSON.parse(FIXTURE));
    assert.equal(packSummary(fromObject.pack), '19 places · 23 routes');
    const again = loadWorldPack(fromObject.pack);
    assert.deepEqual(again.errors, []);
    assert.deepEqual(again.pack, fromObject.pack);
});

test('packSummary uses singulars and copes without a pack', () => {
    const { pack: one } = loadWorldPack({ places: { A: {} }, edges: [{ a: 'A', b: 'B', km: 5, code: 'R' }] });
    assert.equal(packSummary(one), '1 place · 1 route');
    assert.equal(packSummary(null), 'no world pack');
});

test('broken packs are errors, broken edges and missing endpoints are warnings', () => {
    assert.equal(loadWorldPack('{ not json').pack, null);
    assert.match(loadWorldPack('{ not json').errors[0], /JSON/);
    assert.equal(loadWorldPack([]).pack, null);
    assert.equal(loadWorldPack({ places: {} }).pack, null);
    assert.equal(loadWorldPack({ edges: [] }).pack, null);

    const result = loadWorldPack({
        places: { Shorn: {} },
        edges: [
            { a: 'Shorn', b: 'Hidden Ward', km: 10, code: 'L' },
            { a: 'Hidden Ward', b: 'Shorn', km: 12, code: 'l' },
            { a: 'Shorn', b: 'Elsewhere', km: 0, code: 'R' },
            { a: 'Shorn', b: 'Shorn', km: 5, code: 'R' },
        ],
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.pack.edges.length, 2);
    assert.equal(result.pack.edges[1].code, 'L');
    assert.equal(result.warnings.length, 3);
    assert.ok(result.warnings.some(w => /"Hidden Ward" is on 2 edges but not in places/.test(w)));
    // The edge is kept: the endpoint is still a place you can travel to.
    assert.equal(findPlace(result.pack, 'off to the hidden ward'), 'Hidden Ward');
    assert.equal(packSummary(result.pack), '1 place · 2 routes');
});

test('ROUTE_CODES and MODES', () => {
    assert.equal(ROUTE_CODES.W, 'river or canal');
    assert.equal(ROUTE_CODES.R, 'maintained road');
    for (const code of 'WRLBFCAGSTMUHXD') assert.ok(ROUTE_CODES[code], code);
    assert.deepEqual([...MODES], ['foot', 'ride', 'wagon', 'boat', 'ship', 'flight', 'courier']);
});

// ---------------------------------------------------------------------------------------
// Places

test('findPlace takes the longest case-insensitive match inside free text', () => {
    assert.equal(findPlace(pack, 'riding to Hollin\'s Reach at dawn'), 'Hollin\'s Reach');
    assert.equal(findPlace(pack, 'riding to Hollin’s Reach at dawn'), 'Hollin\'s Reach');
    assert.equal(findPlace(pack, 'HOLLIN’S REACH'), 'Hollin\'s Reach');
    assert.equal(findPlace(pack, 'the old lantern post'), 'Old Lantern Post');
    assert.equal(findPlace(pack, 'nowhere at all'), null);
    assert.equal(findPlace(pack, ''), null);
    assert.equal(findPlace(null, 'Shorn'), null);

    const { pack: nested } = loadWorldPack({
        places: { Lantern: {}, 'Old Lantern Post': {}, Ford: {} },
        edges: [{ a: 'Lantern', b: 'Old Lantern Post', km: 1, code: 'L' }],
    });
    assert.equal(findPlace(nested, 'waiting at Old Lantern Post'), 'Old Lantern Post');
    assert.equal(findPlace(nested, 'waiting at the lantern'), 'Lantern');
    // Whole words only.
    assert.equal(findPlace(nested, 'gone to Oxford'), null);
});

test('findPlace reads a short name as the one place it begins', () => {
    assert.equal(findPlace(pack, 'Bluewatch'), 'Bluewatch Village');
    assert.equal(findPlace(pack, 'Old'), null);     // too short to stand for a place
});

test('exitsFrom lists every road out of a place in pack order', () => {
    assert.deepEqual(exitsFrom(pack, 'Bluewatch Village').map(e => `${e.to} ${e.km} ${e.code}`),
        ['Glassdock 440 W', 'Auvoth 70 F', 'Hollin\'s Reach 100 F']);
    assert.equal(exitsFrom(pack, 'Bluewatch Village')[0].corridor, 'Bluewatch Branch');
    assert.deepEqual(exitsFrom(pack, 'Nowhere'), []);
});

// ---------------------------------------------------------------------------------------
// Paces and days

test('paceFor reads numbers, ranges (midpoint), foot pace and R fallback', () => {
    assert.deepEqual(paceFor(pack, 'B', 'ride'), { rate: 35, low: 35, high: 35 });
    assert.deepEqual(paceFor(pack, 'W', 'boat'), { rate: 37.5, low: 30, high: 45 });
    assert.deepEqual(paceFor(pack, 'T', 'ride'), { rate: 18, low: 14, high: 22 });
    assert.deepEqual(paceFor(pack, 'X', 'foot'), { rate: 11.5, low: 8, high: 15 });
    assert.deepEqual(paceFor(pack, 'L', 'foot'), { rate: 24, low: 24, high: 24 });
    assert.deepEqual(paceFor(pack, 'G', 'wagon'), { rate: 22, low: 22, high: 22 });
    assert.deepEqual(paceFor(pack, 'Q', 'ride'), { rate: 40, low: 40, high: 40 });
    assert.deepEqual(paceFor(pack, 'S', 'ship'), { rate: 110, low: 80, high: 140 });
    assert.deepEqual(paceFor(pack, 'A', 'flight'), { rate: 130, low: 100, high: 160 });
    assert.equal(paceFor(pack, 'S', 'foot'), null);
    assert.equal(paceFor(pack, 'R', 'boat'), null);
    assert.equal(paceFor(pack, 'R', 'teleport'), null);
});

test('wagons cannot use T, M, U or H', () => {
    const tiny = tinyPack();
    for (const code of ['T', 'M', 'U', 'H']) {
        assert.equal(paceFor(tiny, code, 'wagon'), null, code);
        assert.ok(paceFor(tiny, code, 'foot'), code);
    }
    assert.deepEqual(paceFor(tiny, 'H', 'ride'), { rate: 11.5, low: 8, high: 15 });
    // The wagon goes round by the road; on foot the trail is shorter.
    assert.deepEqual(hopsText(shortestPath(tiny, 'Ash', 'Birch', { mode: 'wagon' })), ['Cedar 50 R', 'Birch 40 R']);
    assert.deepEqual(hopsText(shortestPath(tiny, 'Ash', 'Birch', { mode: 'foot' })), ['Birch 30 T']);
    assert.equal(shortestPath(tiny, 'Ash', 'Elm', { mode: 'wagon' }), null);
    assert.equal(planRoute(tiny, 'Ash', 'Elm', { mode: 'ride' }).km, 70);
});

test('W corridors are boat only unless a levee road (then R pace); noLevee never', () => {
    for (const mode of ['foot', 'ride', 'wagon']) {
        assert.equal(paceFor(pack, 'W', mode, { corridor: 'Bluewatch Branch' }), null, mode);
        assert.equal(paceFor(pack, 'W', mode, { corridor: 'Upper Ledger' }), null, mode);
        assert.equal(paceFor(pack, 'W', mode), null, mode);
        assert.deepEqual(paceFor(pack, 'W', mode, { corridor: 'Ledger River Trunk' }), paceFor(pack, 'R', mode), mode);
    }
    assert.equal(paceFor(pack, 'W', 'courier', { corridor: 'Glassdock Channel' }).rate, 80);
    const both = { ...pack, rules: { ...pack.rules, leveeRoads: ['Bluewatch Branch'] } };
    assert.equal(paceFor(both, 'W', 'foot', { corridor: 'Bluewatch Branch' }), null);

    // On foot the levee of the Ledger River Trunk is walkable at R pace.
    const levee = planRoute(pack, 'Ledgerford', 'Brightwater Lock', { mode: 'foot' });
    assert.deepEqual(hopsText(levee), ['Northbarge 25 W', 'Brightwater Lock 65 W']);
    assert.deepEqual(levee.hops.map(hop => hop.rate), [24, 24]);
    // The Bluewatch Branch has no levee: on foot it goes the long way round.
    const round = shortestPath(pack, 'Bluewatch Village', 'Glassdock', { mode: 'foot' });
    assert.ok(round.km > 440);
    assert.ok(round.hops.every(hop => hop.corridor !== 'Bluewatch Branch'));
    assert.deepEqual(hopsText(shortestPath(pack, 'Bluewatch Village', 'Glassdock', { mode: 'boat' })), ['Glassdock 440 W']);
});

test('legDays rounds each edge up to the half day', () => {
    assert.equal(legDays(35, 35, pack.rules), 1);
    assert.equal(legDays(55, 35, pack.rules), 2);
    assert.equal(legDays(60, 28, pack.rules), 2.5);
    assert.equal(legDays(100, 28, pack.rules), 4);
    assert.equal(legDays(35, 70, pack.rules), 0.5);
    assert.equal(legDays(70, 16), 4.5);
    assert.equal(legDays(10, 4, { roundUpTo: 1 }), 3);
    assert.equal(legDays(10, 4, { roundUpTo: 0 }), 2.5);
    assert.equal(legDays(10, 0), null);
});
