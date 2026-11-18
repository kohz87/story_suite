// LF4-3 and LF4-6 on the format 4 Ersveil pack: a trip from the narrator's own place sets out from the pack place its name stands for
// (never from the atlas's visits, LF4B2);
// a story route between two pack places the pack does not join is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PRESETS, makeCalendar } from '../../../modules/time/calendar.js';
import { command, deepFreeze, line, makeState } from './helpers/fake-ctx.js';

const content = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8')).content;
const PACK = { places: content.places, routes: content.routes, regions: content.regions ?? [] };
const T0 = makeCalendar(PRESETS.gregorian).toAbs({ year: 1200, month: 2, day: 3, minutes: 8 * 60 });
const base = place => {
    const state = makeState({ place });
    return deepFreeze({ ...state, domains: { ...state.domains, director: { time: { minutes: T0 }, threads: {} } } });
};
const opts = { time: T0, pack: PACK };

const away = (state, place) => deepFreeze({ ...state, domains: { ...state.domains, scene: { place: { name: place, kind: '', region: '' }, present: [] } } });
const visitTo = name => {
    const visited = command(base(name), 'atlas.visit', { name }, opts);
    assert.ok(visited.ok, visited.message);
    return visited.state;
};

test('a trip from an unmapped road sets out from the pack place its name stands for (LF4-3)', () => {
    const trip = line(away(base('Bluewatch Village'), 'Frontier Road south of Bluewatch'), '~ trip Auvoth | by: foot', opts);
    assert.ok(trip.ok, trip.message);
    assert.match(trip.result.summary, /On the road to Auvoth/);
    assert.match(trip.result.summary, /70 km/);
    const town = line(away(base('Auvoth'), 'Auvoth / Guild Grand Hall'), '~ trip Bluewatch Village | by: foot', opts);
    assert.ok(town.ok, town.message);
    assert.match(town.result.summary, /On the road to Bluewatch Village/);
});

// LF4B2: the start reads the place's name and the pack, never the atlas's visits (a system step an edited Re-read keeps from the old text).
test('a visit to another pack place does not change where a trip from an unmapped place sets out (replay == told again)', () => {
    for (const place of ['The Weir', 'Frontier Road south of Bluewatch']) {
        const plain = line(away(base('Bluewatch Village'), place), '~ trip Auvoth | by: foot', opts);
        const visited = line(away(visitTo('Bluewatch Village'), place), '~ trip Auvoth | by: foot', opts);
        const elsewhere = line(away(visitTo('Highmark Capital'), place), '~ trip Auvoth | by: foot', opts);
        for (const other of [visited, elsewhere]) {
            assert.equal(other.ok, plain.ok, `${place}: ${other.message ?? other.result?.summary}`);
            assert.equal(other.code, plain.code, place);
            assert.equal(other.result?.summary, plain.result?.summary, place);
        }
    }
    assert.equal(line(away(visitTo('Bluewatch Village'), 'The Weir'), '~ trip Auvoth | by: foot', opts).code, 'NOT_FOUND');
    // A system visit of the unmapped place itself (with its saved parent) changes nothing either.
    const own = command(base('Frontier Road south of Bluewatch'), 'atlas.visit', { name: 'Frontier Road south of Bluewatch', parents: true }, opts);
    assert.ok(own.ok, own.message);
    const fromOwn = line(own.state, '~ trip Auvoth | by: foot', opts);
    assert.equal(fromOwn.result?.summary, line(away(base('Bluewatch Village'), 'Frontier Road south of Bluewatch'), '~ trip Auvoth | by: foot', opts).result?.summary);
});

test('a trip from an unmapped place with nothing visited still says it is not on the map', () => {
    const trip = line(base('Nowhere Special'), '~ trip Auvoth | by: foot', opts);
    assert.equal(trip.ok, false);
    assert.equal(trip.code, 'NOT_FOUND');
});

test('a story route between two pack places the pack does not join is refused (LF4-6)', () => {
    const bad = line(base('Auvoth'), '+ route Auvoth — Highmark Capital | days: 21', opts);
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'REFUSED');
    assert.match(bad.message, /pack has no road between Auvoth and Highmark Capital/);
    const good = line(base('Auvoth'), '+ route Auvoth — Bluewatch Village | days: 2', opts);
    assert.ok(good.ok, good.message);
    const mine = line(base('Auvoth'), '+ route Auvoth — The Sled & Winch | days: 1', opts);
    assert.ok(mine.ok, mine.message);
});

// LF4-3 rest: a road the narrator puts inside a region sets out from the one pack place in that region its kind of road joins (name only).
test('a trip from "Region / Road" sets out from the pack place that road joins in the region, the same after a visit (LF4-3 rest)', () => {
    const name = 'Bluewatch Reach / Frontier Road';
    const trip = line(away(base('Bluewatch Village'), name), '~ trip Auvoth | by: foot', opts);
    assert.ok(trip.ok, trip.message);
    assert.match(trip.result.summary, /On the road to Auvoth/);
    assert.match(trip.result.summary, /70 km/);
    const visited = line(away(visitTo('Highmark Capital'), name), '~ trip Auvoth | by: foot', opts);
    assert.equal(visited.result?.summary, trip.result.summary);
    // No region in front, or a region the road does not touch: nothing is guessed.
    assert.equal(line(away(base('Bluewatch Village'), 'Frontier Road'), '~ trip Auvoth | by: foot', opts).code, 'NOT_FOUND');
    assert.equal(line(away(base('Bluewatch Village'), 'Highmark Empire / Frontier Road'), '~ trip Auvoth | by: foot', opts).code, 'NOT_FOUND');
});

test('the refusal of a story route does not repeat the quoted line (NB-2)', () => {
    const bad = line(base('Auvoth'), '+ route Auvoth — Highmark Capital | days: 21', opts);
    assert.equal(bad.code, 'REFUSED');
    assert.equal(bad.message.split('was not used').length - 1, 0, 'the line wrapper adds the quote, not the module');
});
