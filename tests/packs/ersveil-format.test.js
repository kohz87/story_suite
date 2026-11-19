// The shipped Ersveil in pack format 4 (job C1, pack format 4 §3): the world pack examples/packs/ersveil (4.1.0) and its game pack examples/packs/ersveil-game
// ("Ersveil rules", 1.0.0), field by field: what each holds and where it sits. The pair is the source now (format 3 is obsolete; its sample is gone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIMATES, CONTENT_KEYS } from '../../packs/limits.js';

const read = path => JSON.parse(readFileSync(new URL(`../../examples/packs/${path}`, import.meta.url), 'utf8'));
const world = read('ersveil/pack.json');
const game = read('ersveil-game/pack.json');

test('the envelopes: format 4, one world and one game, the versions, names and the suite each needs; the world recommends its game', () => {
    assert.deepEqual(Object.keys(world), ['id', 'format', 'kind', 'version', 'name', 'author', 'description', 'requires', 'recommends', 'content']);
    assert.deepEqual([world.id, world.format, world.kind, world.version, world.name, world.author], ['ersveil', 4, 'world', '4.1.0', 'Ersveil (open world)', 'Story Suite examples']);
    assert.deepEqual([game.id, game.format, game.kind, game.version, game.name, game.author], ['ersveil-game', 4, 'game', '1.0.0', 'Ersveil rules', 'Story Suite examples']);
    assert.equal(game.description, 'Calendar, coins, guild ranks, names and trackers for Ersveil');
    assert.match(world.description, /^The world of Ersveil as an open world pack: lore, a map of 320 places joined by routes, 31 people /);
    assert.doesNotMatch(world.description, /spec/);
    assert.deepEqual(world.requires, { suite: '^0.1', capabilities: ['scene', 'chronicle-lasting'] });
    assert.deepEqual(game.requires, { suite: '^0.1', capabilities: ['scene', 'inventory', 'data-modules-v1'] });
    assert.deepEqual(world.recommends, { game: { id: 'ersveil-game', version: '^1.0', name: game.name } });
    assert.equal('recommends' in game, false);
    for (const field of ['calendar', 'weather', 'currency', 'economy', 'start', 'ripples', 'theme']) assert.equal(field in world || field in game, false, `${field} is not a top-level field`);
});

test('the world holds only world kinds, with these counts', () => {
    for (const key of Object.keys(world.content)) assert.ok(CONTENT_KEYS.world.includes(key), key);
    for (const key of Object.keys(game.content)) assert.ok(CONTENT_KEYS.game.includes(key), key);
    const count = value => (Array.isArray(value) ? value.length : Object.keys(value).length);
    assert.deepEqual(Object.fromEntries(Object.entries(world.content).map(([kind, value]) => [kind, count(value)])),
        { places: 320, routes: 352, cast: 31, lore: 218, placeKinds: 20, routeKinds: 16, regions: 30, realms: 22, powers: 15, scores: 4, conditions: 31, markets: 8, worldEvents: 103, templates: 10, start: 3 });
    assert.equal(world.content.events, undefined);
    assert.equal(world.content.items, undefined);
});

test('regions: an id and a name each; 25 with a climate from the known ten, 5 left temperate', () => {
    for (const region of world.content.regions) assert.ok(typeof region.id === 'string' && typeof region.name === 'string', JSON.stringify(region));
    const proposed = world.content.regions.filter(region => region.climate);
    assert.equal(proposed.length, 25);
    for (const region of proposed) assert.ok(CLIMATES.includes(region.climate), region.id);
    assert.deepEqual(world.content.regions.filter(region => !region.climate).map(region => region.id), ['aurelion', 'kingdom-of-ashmere', 'wallwright-league', 'silver-mark', 'wildzone-sites']);
    const climate = id => world.content.regions.find(region => region.id === id).climate;
    assert.deepEqual(['bluewatch-reach', 'deep-northern-apex', 'western-barrens', 'stormmere-isles', 'ironanvil'].map(climate), ['cold', 'frozen', 'arid', 'sea', 'highland']);
});

test('the world start: the world state, the date with the era and the month as a number, the place as the Guild Office\'s id', () => {
    assert.deepEqual(world.content.start, {
        world: {
            set: ['wildzone-pushing@bluewatch-reach: 1 season', 'guild-stretched@bluewatch-reach: 1 season', 'wildzone-pushing@deep-northern-apex: 1 season', 'wildzone-pushing@wildzone-sites: 1 season'],
            facts: ['early-flood-611', 'depths-surge-611', 'front-north-open', 'front-wildzone-sites-open'],
        },
        date: { era: 'CY', year: 611, month: 10, day: 1, hour: 7, minute: 0 },
        place: 'bluewatch-village-guild-office',
    });
    assert.equal(world.content.places.find(place => place.id === world.content.start.place).name, 'Bluewatch Village / Guild Office');
});

test('the game: the calendar (months and seasons, no era and no start), currency, climate weather, names, rank, RPG rules, data modules and the money', () => {
    assert.deepEqual(Object.keys(game.content), ['calendar', 'currency', 'weather', 'names', 'you', 'rpg', 'dataModules', 'start']);
    assert.deepEqual(Object.keys(game.content.calendar), ['months', 'seasons']);
    assert.deepEqual(game.content.calendar.months.map(month => [month.name, month.days]), [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
        ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]]);
    assert.deepEqual(game.content.calendar.seasons.map(season => season.name), ['spring', 'summer', 'autumn', 'winter']);
    assert.deepEqual(game.content.calendar.seasons.find(season => season.name === 'winter').months, ['December', 'January', 'February'], 'the Turning needs winter to be December to February');
    assert.deepEqual(game.content.currency, { name: 'copper', plural: 'copper', short: 'c', coins: [{ name: 'copper', plural: 'copper', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }, { name: 'gold', plural: 'gold', value: 100 }] });
    assert.deepEqual(game.content.you, { rank: { label: 'Guild rank' } });
    assert.equal(game.content.rpg.formula, 'v1');
    assert.equal(game.content.rpg.levelCap, 99);
    assert.deepEqual(game.content.rpg.ranks.map(rank => rank.name), ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
    assert.deepEqual(game.content.start, { money: 40 });
});

test('weather: style climate; four temperate tables, one per season; the 80 regional tables are left out (listed in the notes)', () => {
    assert.deepEqual(Object.keys(game.content.weather), ['style', 'tables']);
    assert.equal(game.content.weather.style, 'climate');
    assert.deepEqual(game.content.weather.tables.map(table => [table.climate, table.season]), ['spring', 'summer', 'autumn', 'winter'].map(season => ['temperate', season]));
    for (const table of game.content.weather.tables) assert.ok(table.weather.length >= 1, table.season);
    const notes = readFileSync(new URL('../../examples/packs/ersveil/CONVERSION-NOTES.md', import.meta.url), 'utf8');
    const regional = notes.split('## 2. Regional weather lines (not carried over)')[1].split('\n## ')[0];
    assert.equal(regional.split('\n').filter(line => line.startsWith('- **')).length, 80);
});

test('names: the 14 cultures and the banned list; every culture names regions by id, and each id is a region of the world', () => {
    const regions = new Set(world.content.regions.map(region => region.id));
    const cultures = Object.entries(game.content.names).filter(([key]) => key !== 'banned');
    assert.equal(cultures.length, 14);
    assert.equal(game.content.names.banned.length, 46);
    for (const [key, culture] of cultures) {
        assert.ok(culture.regions.length >= 1, key);
        for (const id of culture.regions) assert.ok(regions.has(id), `${key}: ${id}`);
    }
});

test('the data modules move to the game pack and name themselves by its id; nothing in the world names pack.ersveil any more', () => {
    assert.deepEqual(game.content.dataModules.map(module => module.slug), ['standing', 'fame', 'guild-membership']);
    const text = JSON.stringify(game.content.dataModules);
    assert.doesNotMatch(text, /pack\.ersveil\//);
    assert.equal(text.match(/pack\.ersveil-game\//g).length, 3);
    assert.doesNotMatch(JSON.stringify(world), /pack\.ersveil\//);
});
