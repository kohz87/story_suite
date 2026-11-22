// The narrator's "Where places lie" line (note-parts/places-line.js) and the points it may use (where.js): owner, 22 Nov, the narrator
// sent the Bluewatch–Auvoth road "east" though Auvoth lies west.
import test from 'node:test';
import assert from 'node:assert/strict';

import { part } from '../../../modules/atlas/atlas/index.js';
import { aboutKm, placesLine } from '../../../modules/atlas/atlas/note-parts/places-line.js';
import { routesLine } from '../../../modules/atlas/atlas/note.js';
import { kmScale, trustedPoint } from '../../../modules/atlas/atlas/where.js';
import { at, makeState, queryFor } from './helpers/fake-ctx.js';

// Ersveil's north, by its coordinates (y grows north); the roads' km give the map 10 km a unit.
const PACK = {
    places: [
        { name: 'Bluewatch Village', aliases: ['Bluewatch'], kind: 'village', x: 64, y: 110 },
        { name: 'Auvoth', kind: 'city', x: 59, y: 110 },
        { name: "Hollin's Reach", aliases: ['Hollin'], kind: 'village', x: 58, y: 104 },
        { name: 'Glassdock', kind: 'port', x: 62, y: 72 },
        { name: 'Shorn', kind: 'city', x: 50, y: 95 },
        { name: 'Highmark Capital', kind: 'capital', x: 64, y: 10 },
        { name: 'Coinwater', kind: 'city', x: 64, y: 50 },
        { name: 'Shackles City', kind: 'city', x: -55, y: -5 },
        { name: 'Sealed Vault', kind: 'city', x: 80, y: 110, hidden: true },
        { name: 'Deep Hall', kind: 'city', x: 70, y: 100, layer: 'underground' },
    ],
    routes: [
        { from: 'Auvoth', to: 'Bluewatch Village', km: 62.5, kind: 'frontier road' },
        { from: 'Bluewatch Village', to: "Hollin's Reach", km: 106.07, kind: 'frontier road' },
        { from: 'Glassdock', to: 'Bluewatch Village', km: 475.3, kind: 'river' },
    ],
};
const view = (state, { said = '', reply = '', settings = {} } = {}) => ({ state, query: (name, args) => queryFor(PACK)(state, name, args), settings: () => settings, chat: { length: 3, lastUser: said, lastReply: reply } });
const tailAt = (place, options) => part.context.tail(view(at(makeState({ place }), place), options)).optional;

test('the line gives the places the message and the last reply name first, then the nearest city or capital each way, as the crow flies', () => {
    const [routes, where] = tailAt('Bluewatch Village', { said: 'I set out for Shackles City.', reply: 'The convoys left Glassdock and Hollin.' });
    assert.match(routes, /^Routes from Bluewatch Village: Auvoth \(west\)/);
    assert.equal(where, 'Where places lie from Bluewatch Village, as the crow flies: Shackles City about 1,650 km south-west · Glassdock about 380 km south · '
        + "Hollin's Reach about 85 km south-west · Auvoth about 50 km west · Shorn about 210 km south-west · Coinwater about 600 km south.");
    assert.doesNotMatch(where, /Sealed Vault/, 'a hidden place is never told');
    assert.doesNotMatch(where, /Deep Hall/, 'a city on another plane is not one of the cities each way');
    assert.doesNotMatch(where, /Highmark/, 'one city each way: the nearest (Coinwater is south and nearer)');
    // the reader's north/east setting turns the words, as it turns the map
    const flipped = tailAt('Bluewatch Village', { settings: { map: { north: 'down', east: 'left' } } })[1];
    assert.match(flipped, /Auvoth about 50 km east · Shorn about 210 km north-east · Coinwater about 600 km north\./);
});

test('the scale comes from the pack\'s roads; without three measured roads it is the reader\'s Km per map unit', () => {
    const world = { places: PACK.places.map((place, i) => ({ ...place, id: String(i) })), routes: [] };
    assert.equal(kmScale(world, { kmPerUnit: '7' }), 7);
    const byName = name => String(PACK.places.findIndex(place => place.name === name));
    world.routes = PACK.routes.map(route => ({ from: byName(route.from), to: byName(route.to), km: route.km }));
    assert.equal(kmScale(world, { kmPerUnit: '1' }), 10);
    assert.deepEqual([aboutKm(0.4), aboutKm(12.4), aboutKm(52), aboutKm(377), aboutKm(1612)], ['about 1 km', 'about 12 km', 'about 50 km', 'about 380 km', 'about 1,600 km']);
});

test('only a point the code can vouch for gives a compass word: the pack\'s, the reader\'s, the story\'s, one inside a vouched-for town; not a guessed one', () => {
    const atlas = { places: {
        guess: { id: 'guess', auto: true },                    // the map's guess: the middle of its region
        inn: { id: 'inn', auto: true, parent: 'town' },         // beside its town
        town: { id: 'town' },                                  // set by the reader (or told by the story)
        stray: { id: 'stray', auto: true, parent: 'guess' },    // beside a guessed town
    } };
    const places = {
        guess: { id: 'guess', atlasId: 'guess', name: 'Fernhollow', x: 1, y: 2 },
        inn: { id: 'inn', atlasId: 'inn', name: 'Gull Inn', x: 3, y: 4 },
        town: { id: 'town', atlasId: 'town', name: 'Weirford', x: 5, y: 6 },
        stray: { id: 'stray', atlasId: 'stray', name: 'Stray Oar', x: 7, y: 8 },
        pack: { id: 'pack:auvoth', name: 'Auvoth', x: 59, y: 110 },
    };
    const world = { find: id => places[id] ?? null };
    const point = id => trustedPoint(places[id], { atlas, world });
    assert.deepEqual([point('guess'), point('inn'), point('town'), point('stray'), point('pack')], [null, { x: 3, y: 4 }, { x: 5, y: 6 }, null, { x: 59, y: 110 }]);
    assert.deepEqual(trustedPoint(places.guess, { atlas, world, packHas: name => name === 'Fernhollow' }), { x: 1, y: 2 }, 'a pack\'s point wins over the guess');
    // the route line: no compass word to a guessed point
    const routeWorld = { places: [places.town, places.guess], routes: [{ from: 'town', to: 'guess', kind: 'road' }], find: ref => [places.town, places.guess].find(p => p.id === ref || p.name === ref) ?? null };
    const pointOf = place => trustedPoint(place, { atlas, world });
    assert.equal(routesLine(routeWorld, 'Weirford', { pointOf }), 'Routes from Weirford: Fernhollow by road, ≈ 0.5 day.');
    assert.equal(placesLine(routeWorld, 'Weirford', { said: 'Fernhollow', pointOf }), '', 'nothing vouched for to tell');
});

test('nothing without a place, a point for it, or an atlas; the tail stays within its room', () => {
    assert.deepEqual(part.context.tail(view(makeState({ place: '' }))), { lines: [], optional: [] });
    assert.deepEqual(tailAt('Nowhere Special'), []);
    const long = tailAt('Bluewatch Village', { said: PACK.places.map(place => place.name).join(', ') })[1];
    assert.ok(long.length <= 400, long);
});
