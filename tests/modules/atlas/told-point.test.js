// A new place the story tells the way to is put on the map from the place it is told from (capture-parts/told-point.js): owner, 22 Nov,
// "the narrative says how far and which way, then it gets saved, then it follows the rule of named places".
import test from 'node:test';
import assert from 'node:assert/strict';

import { part } from '../../../modules/atlas/atlas/index.js';
import { routeKm, toldAt, wayOf } from '../../../modules/atlas/atlas/capture-parts/told-point.js';
import { at, lines, makeState, queryFor } from './helpers/fake-ctx.js';

// Bluewatch and Auvoth as in Ersveil; three roads give the map 10 km a unit (road factor 1.25: 12.5 km of road a unit).
const PACK = {
    places: [
        { name: 'Bluewatch Village', kind: 'village', x: 64, y: 110 },
        { name: 'Auvoth', kind: 'city', x: 59, y: 110 },
        { name: "Hollin's Reach", kind: 'village', x: 58, y: 104 },
        { name: 'Glassdock', kind: 'port', x: 62, y: 72 },
    ],
    routes: [
        { from: 'Auvoth', to: 'Bluewatch Village', km: 62.5, kind: 'frontier road' },
        { from: 'Bluewatch Village', to: "Hollin's Reach", km: 106.07, kind: 'frontier road' },
        { from: 'Glassdock', to: 'Bluewatch Village', km: 475.3, kind: 'river' },
    ],
};
const opts = { pack: PACK };
const place = (state, name) => Object.values(state.domains.atlas.places).find(entry => entry.name === name);
const where = (state, here, said) => part.context.tail({ state: at(state, here), query: (name, args) => queryFor(PACK)(at(state, here), name, args), settings: () => ({}), chat: { length: 3, lastUser: said, lastReply: '' } }).optional;

test('the way words: eight directions in words, joined or hyphened, and letters; anything else is no way', () => {
    assert.deepEqual(['north', 'North-East', 'northeast', 'north east', 'to the south-west', 'NW', 'e'].map(wayOf), ['n', 'ne', 'ne', 'ne', 'sw', 'nw', 'e']);
    assert.deepEqual(['up', 'north-north-east', 'northsouth', '', undefined].map(wayOf), [null, null, null, null, null]);
    assert.deepEqual(toldAt('12 km north-east of Bluewatch Village'), { km: 12, way: 'ne', of: 'Bluewatch Village' });
    assert.equal(toldAt('12, 40'), null);
    assert.equal(toldAt('a day north of Bluewatch'), null);
    assert.deepEqual([routeKm({ days: 1 }), routeKm({ hours: 5, kind: 'road' }), routeKm({ days: 1, kind: 'river' }), routeKm({})], [20, 20, 35, null]);
});

test('a route\'s way puts a new place on the map from the known one, and later lines give its direction from the code', () => {
    let state = makeState({ place: 'Bluewatch Village' });
    state = lines(state, '+ route Bluewatch Village — Fernhollow | days: 1 | kind: trail | way: north', opts).state;
    const fern = place(state, 'Fernhollow');
    // 20 km of trail, 16 km straight, 1.6 units north of (64, 110)
    assert.deepEqual([fern.x, fern.y, fern.auto], [64, 111.6, undefined]);
    assert.match(where(state, 'Auvoth', 'Is Fernhollow far?')[1], /Fernhollow about 50 km east\./);
    // the first place the new one: the way still reads from the first to the second
    state = lines(state, '+ route Greywater — Auvoth | hours: 5 | kind: road | way: west', opts).state;
    const grey = place(state, 'Greywater');
    assert.deepEqual([grey.x, grey.y], [60.6, 110]);
    // km: wins over the time
    state = lines(state, '+ route Bluewatch Village — Pike Ford | days: 3 | km: 25 | way: south', opts).state;
    assert.deepEqual([place(state, 'Pike Ford').x, place(state, 'Pike Ford').y], [64, 108]);
});

test('a landmark told from a place lands that far that way, as the crow flies; the reader\'s north/east setting is read', () => {
    let state = makeState({ place: 'Auvoth' });
    state = lines(state, '+ landmark Grey Cairn | kind: ruin | at: 30 km south-east of Auvoth', opts).state;
    const cairn = place(state, 'Grey Cairn');
    assert.deepEqual([cairn.x, cairn.y], [61.121, 107.879]);
    const flipped = lines(makeState({ place: 'Auvoth' }), '+ landmark Grey Cairn | at: 10 km north of Auvoth', { ...opts, settings: { map: { north: 'down' } } }).state;
    assert.deepEqual([place(flipped, 'Grey Cairn').x, place(flipped, 'Grey Cairn').y], [59, 109]);
});

test('the story never moves a place the code already vouches for, a pack place, or one told from a place with no point; the same line gives the same point', () => {
    let state = makeState({ place: 'Bluewatch Village' });
    state = lines(state, '+ landmark Grey Cairn | at: 10 km north of Bluewatch Village', opts).state;
    state = lines(state, '+ landmark Grey Cairn | at: 50 km south of Bluewatch Village', opts).state;
    assert.deepEqual([place(state, 'Grey Cairn').x, place(state, 'Grey Cairn').y], [64, 111], 'told once: a later telling does not move it');
    state = lines(state, '+ landmark Auvoth | at: 10 km north of Bluewatch Village', opts).state;
    assert.equal(place(state, 'Auvoth').x, undefined, 'a pack place keeps the pack\'s point');
    state = lines(state, '+ landmark Old Mill | at: 5 km east of Nowhere Known', opts).state;
    assert.equal(place(state, 'Old Mill').x, undefined, 'no point to tell it from');
    state = lines(state, '+ route Bluewatch Village — Weir | days: 1 | way: sideways', opts).state;
    assert.equal(place(state, 'Weir').x, undefined, 'no way the code can read: the route stands, unplaced');
    const again = lines(makeState({ place: 'Bluewatch Village' }), '+ landmark Grey Cairn | at: 10 km north of Bluewatch Village', opts).state;
    assert.deepEqual(place(again, 'Grey Cairn'), place(lines(makeState({ place: 'Bluewatch Village' }), '+ landmark Grey Cairn | at: 10 km north of Bluewatch Village', opts).state, 'Grey Cairn'));
});
