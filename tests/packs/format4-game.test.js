// Pack format 4, the game validator (job P3): calendar and seasons, weather style and climate tables, start, pacing, rpg.pull, playerRank inside the pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { refused } from './validate.helpers.js';

const months = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 30 }, { name: 'Sun', days: 30 }, { name: 'Leaf', days: 30 }];
const game = content => ({ id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1', capabilities: ['data-modules-v1'] }, content });
const ok = content => { const result = validatePack(game(content)); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };
const pathsOf = result => result.errors.map(error => error.path);

test('calendar: months, era, holidays, leap years, week and seasons; the normalized calendar has no start', () => {
    const { pack } = ok({ calendar: { era: 'CY', months, leapYears: true, week: ['Mon', 'Tue'], holidays: [{ name: 'Fest', month: 'bloom', day: 3 }],
        seasons: [{ name: 'winter', months: ['frost', 2] }, { name: 'summer', months: ['Sun', 'Leaf'] }] } });
    assert.equal(pack.calendar.era, 'CY');
    assert.equal(pack.calendar.leapYears, true);
    assert.deepEqual(pack.calendar.week, ['Mon', 'Tue']);
    assert.deepEqual(pack.calendar.seasons[0].months, ['Frost', 'Bloom']);
    assert.equal(pack.calendar.holidays[0].month, 'Bloom');
    assert.equal('start' in pack.calendar, false);
});

test('calendar: bad months, a start, a month in two seasons, an unknown month and a bad week are refused', () => {
    const bad = calendar => pathsOf(refused(game({ calendar }), 'BAD_CALENDAR'));
    assert.ok(bad({ months, start: { year: 1, month: 1, day: 1 } }).includes('content.calendar.start'));
    assert.ok(bad({ months: [] }).includes('content.calendar.months'));
    assert.ok(bad({ months, seasons: [{ name: 'a', months: ['Frost'] }, { name: 'b', months: ['Frost'] }] }).includes('content.calendar.seasons[1].months'));
    assert.ok(bad({ months, seasons: [{ name: 'a', months: ['Nope'] }] }).includes('content.calendar.seasons[0].months'));
    assert.ok(bad({ months, seasons: [{ name: 'a', months: ['Frost'] }, { name: 'A', months: ['Sun'] }] }).includes('content.calendar.seasons[1].name'));
    assert.ok(bad({ months, week: ['Mon', 'mon'] }).includes('content.calendar.week'));
    assert.ok(bad({ months, leapYears: 'yes' }).includes('content.calendar.leapYears'));
    refused(game({ calendar: { months, extra: 1 } }), 'UNKNOWN_FIELD');
});

test('weather: style defaults to climate; tables are keyed by climate; region and unknown climates are refused', () => {
    const lines = ['fog', 'rain'];
    const { pack, warnings } = ok({ calendar: { months, seasons: [{ name: 'winter', months: ['Frost'] }] }, weather: { tables: [{ climate: 'cold', season: 'Winter', weather: lines }, { weather: lines }] } });
    assert.equal(pack.weather.style, 'climate');
    assert.equal(pack.weather.tables[0].climate, 'cold');
    assert.equal(pack.weather.tables[1].season, '');
    assert.equal((warnings ?? []).length, 0);
    assert.ok(pathsOf(refused(game({ weather: { tables: [{ region: 'North', weather: lines }] } }), 'UNKNOWN_FIELD')).includes('content.weather.tables[0].region'));
    assert.ok(pathsOf(refused(game({ weather: { tables: [{ climate: 'lava', weather: lines }] } }), 'BAD_WEATHER')).includes('content.weather.tables[0].climate'));
    refused(game({ weather: { style: 'rolled' } }), 'BAD_WEATHER');
    refused(game({ weather: { seasons: [] } }), 'UNKNOWN_FIELD');
    refused(game({ weather: { tables: [{ weather: [] }] } }), 'BAD_WEATHER');
    const warned = ok({ weather: { style: 'story', tables: [{ season: 'monsoon', weather: lines }] } }).warnings.map(warning => warning.code);
    assert.deepEqual(warned.sort(), ['UNUSED_SEASON', 'UNUSED_TABLES']);
});

test('start: money and items; a world field or a bad value is refused', () => {
    const { pack } = ok({ start: { money: 40, items: [{ name: 'Rope' }, { name: 'Lamp', qty: 2, note: 'old' }] } });
    assert.deepEqual(pack.start, { money: 40, items: [{ name: 'Rope', qty: 1, note: '' }, { name: 'Lamp', qty: 2, note: 'old' }] });
    assert.ok(pathsOf(refused(game({ start: { place: 'x' } }), 'UNKNOWN_FIELD')).includes('content.start.place'));
    for (const start of [{ money: -1 }, { money: 1.5 }, { money: '4' }, { items: [{ name: 'a', qty: 0 }] }, { items: [{ name: 'a' }, { name: 'A' }] }, { items: [{ name: '' }] }, { items: ['rope'] }]) refused(game({ start }), 'BAD_START');
});

test('pacing: tempo 0.25 to 4', () => {
    assert.deepEqual(ok({ pacing: { tempo: 2 } }).pack.pacing, { tempo: 2 });
    for (const tempo of [0.2, 5, '1']) refused(game({ pacing: { tempo } }), 'BAD_CONTENT');
    refused(game({ pacing: { speed: 1 } }), 'UNKNOWN_FIELD');
});

test('rpg.pull: abilities 1 to 6 and stance; kept as a record; playerRank.module must be a data module of this pack', () => {
    const mod = { slug: 'guild', name: 'Guild', schema: 1, stateVersion: 1, scope: 'chat', fields: [] };
    const { pack } = ok({ rpg: { formula: 'v1', pull: { abilities: 3, stance: false } } });
    assert.deepEqual(pack.content.rpg.find(record => record.slug === 'pull'), { id: 'g/pull', slug: 'pull', pack: 'g', abilities: 3, stance: false });
    for (const pull of [{ abilities: 0 }, { abilities: 7 }, { abilities: 1.5 }, { stance: 'yes' }, 'x']) refused(game({ rpg: { pull } }), 'BAD_CONTENT');
    refused(game({ rpg: { pull: { more: 1 } } }), 'UNKNOWN_FIELD');
    const rank = module => game({ rpg: { playerRank: { module, field: 'letter', label: 'Guild' } }, dataModules: [mod] });
    assert.ok(pathsOf(refused(rank('other'), 'UNKNOWN_REF')).includes('content.rpg.playerRank.module'));
    assert.ok(!(validatePack(rank('guild')).errors ?? []).some(error => error.code === 'UNKNOWN_REF'));
    refused(game({ rpg: { playerRank: { module: 'guild', field: 'letter', label: 'Guild' } } }), 'UNKNOWN_REF');
});

test('format 3 still refuses `pull` (it is a format 4 field)', () => {
    const result = validatePack({ id: 'f3', format: 3, version: '1.0.0', requires: { suite: '^0.1' }, content: { rpg: { pull: { abilities: 2 } } } });
    assert.equal(result.ok, false);
});
