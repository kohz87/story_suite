// `~ trip stop` on the road: the trip's own cue to write `~ place` goes with the trip, so the stop asks the narrator for the place itself
// (soak W17: the header, the routes line and the map kept the place the party left); at a place there is nothing to ask.
import test from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../modules/time/calendar.js';
import { deepFreeze, line, makeState } from './helpers/fake-ctx.js';

const calendar = makeCalendar(PRESETS.gregorian);
const DAY = 1440;
const T0 = calendar.toAbs({ year: 1200, month: 2, day: 3, minutes: 8 * 60 });
const PACK = {
    places: [
        { name: 'Bluewatch Village', region: 'Bluewatch', kind: 'village', x: 64, y: 110 },
        { name: "Hollin's Reach", region: 'Frontier', kind: 'town', x: 40, y: 90 },
        { name: 'Wolfmere Outpost', region: 'Frontier', kind: 'fort', x: 20, y: 70 },
    ],
    routes: [
        { from: 'Bluewatch Village', to: "Hollin's Reach", kind: 'frontier road', km: 100 },
        { from: "Hollin's Reach", to: 'Wolfmere Outpost', kind: 'frontier road', km: 60 },
    ],
};
const at = (minutes, base) => deepFreeze({ ...(base ?? makeState({ place: 'Bluewatch Village' })), domains: { ...(base ?? makeState({ place: 'Bluewatch Village' })).domains,
    scene: { place: { name: 'Bluewatch Village', kind: '', region: '' }, present: [] }, director: { time: { minutes }, threads: {} } } });

test('a stop on the road asks the narrator to write the place; a stop at a place does not', () => {
    const set = line(at(T0), '~ trip Wolfmere Outpost | by: foot', { time: T0, pack: PACK });
    assert.ok(set.ok, set.message);
    const road = line(at(T0 + 2 * DAY, set.state), '~ trip stop', { time: T0 + 2 * DAY, pack: PACK });
    assert.ok(road.ok, road.message);
    assert.equal(road.result.narrate, true, 'the next reply is told');
    assert.match(road.result.summary, /ends on the road between Bluewatch Village and Hollin's Reach, 40 of 100 km along\. Write ~ place for where \{\{user\}\} is, on the road between Bluewatch Village and Hollin's Reach\./);
    const home = line(at(T0, set.state), '~ trip stop', { time: T0, pack: PACK });
    assert.equal(home.result.narrate, false);
    assert.doesNotMatch(home.result.summary, /Write ~ place/);
});
