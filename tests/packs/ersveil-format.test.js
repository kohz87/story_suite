// The shipped Ersveil in pack format 4 (job C1, pack format 4 §3): the world pack examples/packs/ersveil (4.0.0) and its game pack examples/packs/ersveil-game
// ("Ersveil rules", 1.0.0), field by field against the format 3 source (examples/packs/ersveil-world, Ersveil 3.0.0): what moved where, what is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIMATES, CONTENT_KEYS } from '../../packs/limits.js';

const read = path => JSON.parse(readFileSync(new URL(`../../examples/packs/${path}`, import.meta.url), 'utf8'));
const world = read('ersveil/pack.json');
const game = read('ersveil-game/pack.json');
const source = read('ersveil-world/pack.json');

test('the envelopes: format 4, one world and one game, the versions, names and the suite each needs; the world recommends its game', () => {
    assert.deepEqual(Object.keys(world), ['id', 'format', 'kind', 'version', 'name', 'author', 'description', 'requires', 'recommends', 'content']);
    assert.deepEqual([world.id, world.format, world.kind, world.version, world.name, world.author], ['ersveil', 4, 'world', '4.0.0', 'Ersveil (open world)', 'Story Suite examples']);
    assert.deepEqual([game.id, game.format, game.kind, game.version, game.name, game.author], ['ersveil-game', 4, 'game', '1.0.0', 'Ersveil rules', 'Story Suite examples']);
    assert.equal(game.description, 'Calendar, coins, guild ranks, names and trackers for Ersveil');
    assert.equal(world.description, source.description.replace(' (world-pack spec v0.14.11)', ''), 'the description is kept, with the spec reference dropped');
    assert.doesNotMatch(world.description, /spec/);
    assert.deepEqual(world.requires, { suite: '^0.1', capabilities: ['scene', 'chronicle-lasting'] });
    assert.deepEqual(game.requires, { suite: '^0.1', capabilities: ['scene', 'inventory', 'data-modules-v1'] });
    assert.deepEqual(world.recommends, { game: { id: 'ersveil-game', version: '^1.0' } });
    assert.equal('recommends' in game, false);
    for (const field of ['calendar', 'weather', 'currency', 'economy', 'start', 'ripples', 'theme']) assert.equal(field in world || field in game, false, `${field} is not a top-level field`);
});

test('the world holds only world kinds, and every one but regions and start is the source\'s, unchanged', () => {
    for (const key of Object.keys(world.content)) assert.ok(CONTENT_KEYS.world.includes(key), key);
    for (const key of Object.keys(game.content)) assert.ok(CONTENT_KEYS.game.includes(key), key);
    const same = ['lore', 'placeKinds', 'routeKinds', 'places', 'routes', 'realms', 'markets', 'conditions', 'powers', 'scores', 'worldEvents', 'templates', 'cast'];
    for (const kind of same) assert.deepEqual(world.content[kind], source.content[kind], kind);
    const count = value => (Array.isArray(value) ? value.length : Object.keys(value).length);
    assert.deepEqual(Object.fromEntries(Object.entries(world.content).map(([kind, value]) => [kind, count(value)])),
        { places: 320, routes: 352, cast: 31, lore: 218, placeKinds: 20, routeKinds: 16, regions: 30, realms: 22, powers: 15, scores: 4, conditions: 31, markets: 8, worldEvents: 103, templates: 10, start: 3 });
    assert.equal(world.content.events, undefined);
    assert.equal(world.content.items, undefined);
});

test('regions keep their ids and names and gain the proposed climate: 25 proposed from the known ten, 5 left for the author (temperate)', () => {
    assert.deepEqual(world.content.regions.map(({ climate, ...rest }) => rest), source.content.regions);
    const proposed = world.content.regions.filter(region => region.climate);
    assert.equal(proposed.length, 25);
    for (const region of proposed) assert.ok(CLIMATES.includes(region.climate), region.id);
    assert.deepEqual(world.content.regions.filter(region => !region.climate).map(region => region.id), ['aurelion', 'kingdom-of-ashmere', 'wallwright-league', 'silver-mark', 'wildzone-sites']);
    const climate = id => world.content.regions.find(region => region.id === id).climate;
    assert.deepEqual(['bluewatch-reach', 'deep-northern-apex', 'western-barrens', 'stormmere-isles', 'ironanvil'].map(climate), ['cold', 'frozen', 'arid', 'sea', 'highland']);
});

test('the world start: start.world unchanged, the date with the era and the month as a number, the place as the Guild Office\'s id', () => {
    assert.deepEqual(world.content.start, {
        world: source.start.world,
        date: { era: 'CY', year: 611, month: 10, day: 1, hour: 7, minute: 0 },
        place: 'bluewatch-village-guild-office',
    });
    assert.equal(world.content.places.find(place => place.id === world.content.start.place).name, source.start.scene.place.name);
});

test('the game: the calendar (months and seasons, no era and no start), currency, climate weather, names, rank, RPG rules, data modules and the money', () => {
    assert.deepEqual(Object.keys(game.content), ['calendar', 'currency', 'weather', 'names', 'you', 'rpg', 'dataModules', 'start']);
    assert.deepEqual(game.content.calendar, { months: source.calendar.months, seasons: source.weather.seasons });
    assert.deepEqual(game.content.calendar.seasons.find(season => season.name === 'winter').months, ['December', 'January', 'February'], 'the Turning needs winter to be December to February');
    assert.deepEqual(game.content.currency, source.currency);
    assert.deepEqual(game.content.you, { rank: { label: 'Guild rank' } });
    assert.deepEqual(game.content.rpg, { formula: 'v1', ...source.content.rpg });
    assert.deepEqual(game.content.start, { money: 40 });
});

test('weather: style climate; the four general tables become the temperate ones; the 80 regional tables are left out (listed in the notes)', () => {
    const general = source.weather.tables.filter(table => !table.region);
    assert.equal(general.length, 4);
    assert.deepEqual(game.content.weather, { style: 'climate', tables: general.map(table => ({ climate: 'temperate', season: table.season, weather: table.weather })) });
    assert.equal(source.weather.tables.length - general.length, 80);
    const notes = readFileSync(new URL('../../examples/packs/ersveil/CONVERSION-NOTES.md', import.meta.url), 'utf8');
    for (const table of source.weather.tables.filter(entry => entry.region)) assert.ok(notes.includes(table.weather.join(' / ')), `${table.region} ${table.season}`);
});

test('names: the 14 cultures and the banned list; every culture names regions by id, and each id is a region of the world', () => {
    const regions = new Set(world.content.regions.map(region => region.id));
    const cultures = Object.entries(game.content.names).filter(([key]) => key !== 'banned');
    assert.equal(cultures.length, 14);
    assert.deepEqual(game.content.names.banned, source.content.names.banned);
    for (const [key, culture] of cultures) {
        assert.ok(culture.regions.length >= 1, key);
        for (const id of culture.regions) assert.ok(regions.has(id), `${key}: ${id}`);
        assert.deepEqual(culture, source.content.names[key], `${key} needed no re-keying`);
    }
});

test('the data modules move to the game pack and name themselves by its id; nothing in the world names pack.ersveil any more', () => {
    assert.deepEqual(game.content.dataModules.map(module => module.slug), ['standing', 'fame', 'guild-membership']);
    const text = JSON.stringify(game.content.dataModules);
    assert.doesNotMatch(text, /pack\.ersveil\//);
    assert.equal(text.match(/pack\.ersveil-game\//g).length, 3);
    assert.equal(text, JSON.stringify(source.content.dataModules).replaceAll('pack.ersveil/', 'pack.ersveil-game/'));
    assert.doesNotMatch(JSON.stringify(world), /pack\.ersveil\//);
});
