// Pack format 4 world map: `places` and `routes` (the atlas Story Director reads): normalizing, every rejection, and the packs.content query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacksPart } from '../../packs/index.js';
import { validatePack } from '../../packs/validate.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { pack } from './helpers/fixtures.js';

// Fields set to undefined are left out, as in a JSON file.
const plain = input => JSON.parse(JSON.stringify(input));
const ok = input => {
    const result = validatePack(plain(input));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.pack;
};
const refused = (input, code, path) => {
    const result = validatePack(plain(input));
    assert.equal(result.ok, false, `expected ${code} at ${path}`);
    assert.ok(result.errors.some(error => error.code === code && (path === undefined || error.path === path)), JSON.stringify(result.errors));
    return result.errors;
};

const PLACES = [
    { name: 'Bluewatch Village', region: 'River Confederacy', kind: 'village', x: 64, y: 110, aliases: ['Bluewatch'] },
    { name: 'Auvoth', region: 'Auvoth Compact', kind: 'city', x: 59, y: 110 },
    { name: 'Auvoth Depths', kind: 'site', layer: 'underground', x: 58.8, y: 110.2 },
];
const ROUTES = [{ from: 'Bluewatch', to: 'auvoth', kind: 'road', km: 70, corridor: 'Bluewatch–Auvoth Frontier Road' }, { from: 'auvoth', to: 'Auvoth Depths', kind: 'sea', hours: 1 }];
const map = (extra = {}) => pack({ content: { places: PLACES, routes: ROUTES }, ...extra });

test('places and routes are normalized: names, aliases, ids, routes stored with place names', () => {
    const normalized = ok(map());
    assert.deepEqual(normalized.content.places[0], {
        name: 'Bluewatch Village', aliases: ['Bluewatch'], region: 'River Confederacy', kind: 'village', layer: '', x: 64, y: 110, note: '',
        id: 'pack.mini/bluewatch-village', slug: 'bluewatch-village', pack: 'mini',
    });
    assert.equal(normalized.content.places[2].layer, 'underground');
    assert.deepEqual(normalized.content.routes, [
        { from: 'Bluewatch Village', to: 'Auvoth', kind: 'road', km: 70, hours: null, corridor: 'Bluewatch–Auvoth Frontier Road', note: '', id: 'pack.mini/bluewatch-auvoth-road', slug: 'bluewatch-auvoth-road', pack: 'mini' },
        { from: 'Auvoth', to: 'Auvoth Depths', kind: 'sea', km: null, hours: 1, corridor: '', note: '', id: 'pack.mini/auvoth-auvoth-depths-sea', slug: 'auvoth-auvoth-depths-sea', pack: 'mini' },
    ], 'a route names places by name, alias or slug; it is kept with their names');
    assert.equal(ok(map({ content: { places: PLACES, routes: [{ ...ROUTES[0], slug: 'frontier' }] } })).content.routes[0].id, 'pack.mini/frontier');
});

test('place rejections', () => {
    const place = extra => pack({ content: { places: [{ name: 'Shorn', x: 50, y: 95, ...extra }] } });
    refused(place({ x: undefined }), 'BAD_RECORD', 'content.places[0].x');
    refused(place({ y: '95' }), 'BAD_RECORD', 'content.places[0].y');
    refused(place({ x: 1e7 }), 'BAD_RECORD', 'content.places[0].x');
    refused(place({ kind: 7 }), 'BAD_RECORD', 'content.places[0].kind');
    refused(place({ region: 'x'.repeat(81) }), 'BAD_RECORD', 'content.places[0].region');
    refused(place({ aliases: 'Shorn Town' }), 'BAD_RECORD', 'content.places[0].aliases');
    refused(place({ note: 'x'.repeat(501) }), 'BAD_RECORD', 'content.places[0].note');
    refused(place({ population: 3000 }), 'UNKNOWN_FIELD', 'content.places[0].population');
    refused(pack({ content: { places: [{ x: 1, y: 1 }] } }), 'BAD_RECORD', 'content.places[0].name');
    refused(pack({ content: { places: [{ name: 'Shorn', x: 1, y: 1 }, { name: 'shorn', x: 2, y: 2 }] } }), 'DUPLICATE', 'content.places[1]');
    refused(pack({ content: { places: {} } }), 'BAD_CONTENT', 'content.places');
});

test('route rejections', () => {
    const route = extra => pack({ content: { places: PLACES, routes: [{ from: 'Bluewatch Village', to: 'Auvoth', kind: 'road', ...extra }] } });
    refused(route({ to: 'Glassdock' }), 'UNKNOWN_REF', 'content.routes[0].to');
    refused(route({ from: undefined }), 'UNKNOWN_REF', 'content.routes[0].from');
    refused(route({ to: 'Bluewatch' }), 'BAD_RECORD', 'content.routes[0].to');
    refused(route({ kind: '' }), 'BAD_RECORD', 'content.routes[0].kind');
    refused(route({ kind: undefined }), 'BAD_RECORD', 'content.routes[0].kind');
    refused(route({ km: 0 }), 'BAD_RECORD', 'content.routes[0].km');
    refused(route({ hours: -1 }), 'BAD_RECORD', 'content.routes[0].hours');
    refused(route({ km: '70' }), 'BAD_RECORD', 'content.routes[0].km');
    refused(route({ corridor: 3 }), 'BAD_RECORD', 'content.routes[0].corridor');
    refused(route({ code: 'F' }), 'UNKNOWN_FIELD', 'content.routes[0].code');
    refused(route({ slug: 'Not A Slug' }), 'BAD_RECORD', 'content.routes[0].slug');
    refused(pack({ content: { routes: [{ from: 'A', to: 'B', kind: 'road' }] } }), 'UNKNOWN_REF', 'content.routes[0].from');
    refused(pack({ content: { places: PLACES, routes: [ROUTES[0], { ...ROUTES[0], km: 80 }] } }), 'DUPLICATE', 'content.routes[1]');
    // The same two places joined twice need a name on each route; named, they are two routes.
    refused(pack({ content: { places: PLACES, routes: [ROUTES[0], { ...ROUTES[0], kind: 'river' }] } }), 'BAD_RECORD', 'content.routes[0].name');
    assert.equal(ok(pack({ content: { places: PLACES, routes: [{ ...ROUTES[0], name: 'High road' }, { ...ROUTES[0], name: 'River way', kind: 'river' }] } })).content.routes.length, 2);
});

test('packs.content gives the places and routes of the enabled world, narrowed by pack; a second world installs switched off and gives none', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    await packs.install(map({ id: 'north' }));
    await packs.install(pack({ id: 'south', content: { places: [{ name: 'Thousand Sails', x: 40, y: 40 }] } }));
    assert.deepEqual(packs.list().map(entry => [entry.id, entry.enabled]), [['north', true], ['south', false]]);
    assert.deepEqual(part.queries['packs.content']({}, { kind: 'places' }).map(place => [place.pack, place.name]), [['north', 'Bluewatch Village'], ['north', 'Auvoth'], ['north', 'Auvoth Depths']]);
    assert.deepEqual(part.queries['packs.content']({}, { kind: 'places', pack: 'north' }).map(place => place.name), ['Bluewatch Village', 'Auvoth', 'Auvoth Depths']);
    assert.deepEqual(part.queries['packs.content']({}, { kind: 'places', pack: 'south' }), []);
    assert.equal(part.queries['packs.content']({}, { kind: 'routes' }).length, 2);
    assert.deepEqual(packs.list().map(entry => entry.counts.places), [3, 1]);
});
