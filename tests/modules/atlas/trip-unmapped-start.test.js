// LF4-3 and LF4-6 on the format 4 Ersveil pack: a trip from the narrator's own place sets out from the pack place it stands for;
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

test('a trip from an unmapped road starts from the last mapped place (LF4-3)', () => {
    const visited = command(base('Bluewatch Village'), 'atlas.visit', { name: 'Bluewatch Village' }, opts);
    assert.ok(visited.ok, visited.message);
    const state = visited.state;
    const away = deepFreeze({ ...state, domains: { ...state.domains, scene: { place: { name: 'Frontier Road south of Bluewatch', kind: '', region: '' }, present: [] } } });
    const trip = line(away, '~ trip Auvoth | by: foot', opts);
    assert.ok(trip.ok, trip.message);
    assert.match(trip.result.summary, /On the road to Auvoth/);
    assert.match(trip.result.summary, /70 km/);
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
