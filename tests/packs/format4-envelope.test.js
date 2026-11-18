// Pack format 4, the envelope (job P1): `format` 4 with `kind` "world" or "game", `recommends`, the top-level fields, the `content` keys of each kind with their "belongs in a … pack" pointers, and format 3 still read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { PACK_FORMAT } from '../../packs/limits.js';
import { codes, refused } from './validate.helpers.js';
import { pack } from './helpers/fixtures.js';

const world = extra => ({ id: 'w', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {}, ...extra });
const game = extra => ({ id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: {}, ...extra });
const ok = input => { const result = validatePack(input); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };
const messageAt = (result, path) => result.errors.find(error => error.path === path)?.message ?? '';

test('format 4 is the newest format; a world and a game pack both install, and the normalized pack says its kind', () => {
    assert.equal(PACK_FORMAT, 4);
    assert.equal(ok(world()).pack.kind, 'world');
    assert.equal(ok(game()).pack.kind, 'game');
    assert.equal(ok(world()).pack.format, 4);
    refused(world({ format: 5 }), 'FORMAT_NEWER');
});

test('kind is required and is "world" or "game": anything else is refused, whatever its type', () => {
    const noKind = world(); delete noKind.kind;
    refused(noKind, 'BAD_KIND');
    for (const bad of ['', 'World', 'both', 'story', null, 1, true, [], ['world'], {}, { kind: 'world' }]) refused(world({ kind: bad }), 'BAD_KIND');
    // A bad kind leaves the content unchecked, so the content errors do not pile on top of it.
    assert.deepEqual(codes(validatePack(world({ kind: 'x', content: { calendar: {} } }))).filter(code => code === 'UNKNOWN_KIND').length, 1);
});

test('format 3 and older packs may not use `kind` or `recommends` (they are format 4 fields)', () => {
    refused(pack({ format: 3, requires: { suite: '^0.1' }, kind: 'world' }), 'UNKNOWN_FIELD');
    refused(pack({ format: 3, requires: { suite: '^0.1' }, recommends: {} }), 'UNKNOWN_FIELD');
    refused(pack({ kind: 'game' }), 'UNKNOWN_FIELD');
});

test('top-level fields: format 3 fields that moved say where they went; unknown ones are refused', () => {
    for (const field of ['currency', 'economy', 'calendar', 'weather']) {
        const result = refused(game({ [field]: {} }), 'UNKNOWN_FIELD');
        assert.match(messageAt(result, field), /belongs in a game pack, under content/);
    }
    assert.match(messageAt(refused(world({ start: {} }), 'UNKNOWN_FIELD'), 'start'), /goes under content/);
    for (const field of ['ripples', 'layouts', 'screens', 'theme']) assert.match(messageAt(refused(world({ [field]: {} }), 'UNKNOWN_FIELD'), field), /not a pack field any more/);
    refused(world({ extra: 1 }), 'UNKNOWN_FIELD');
    refused(world({ constructor: 1 }), 'UNSAFE_KEY');
});

test('content keys: a key of the other kind says "belongs in a … pack"; legacy and unknown keys are refused', () => {
    for (const key of ['calendar', 'currency', 'economy', 'weather', 'names', 'you', 'rpg', 'dataModules', 'meterPresets', 'pacing']) {
        assert.match(messageAt(refused(world({ content: { [key]: {} } }), 'UNKNOWN_KIND'), `content.${key}`), /belongs in a game pack, not in a world pack/);
    }
    for (const key of ['lore', 'placeKinds', 'routeKinds', 'places', 'routes', 'regions', 'realms', 'markets', 'cast', 'powers', 'scores', 'conditions', 'worldEvents', 'templates', 'foes', 'items']) {
        assert.match(messageAt(refused(game({ content: { [key]: [] } }), 'UNKNOWN_KIND'), `content.${key}`), /belongs in a world pack, not in a game pack/);
    }
    assert.match(messageAt(refused(world({ content: { events: [] } }), 'UNKNOWN_KIND'), 'content.events'), /use worldEvents/);
    for (const key of ['skills', 'creatures', 'shops', 'recipes', 'quests', 'races', 'talents', 'presets', 'terms', 'ranks', 'crafts', 'nonsense']) {
        for (const make of [world, game]) assert.match(messageAt(refused(make({ content: { [key]: [] } }), 'UNKNOWN_KIND'), `content.${key}`), /is not a content key of a (world|game) pack/);
    }
});

test('both kinds take `start` and `content` must be an object', () => {
    ok(world({ content: { start: { world: { set: [], facts: [] } } } }));
    ok(game({ content: { start: { money: 5 } } }));
    refused(game({ content: [] }), 'BAD_CONTENT');
    refused(world({ content: 'places' }), 'BAD_CONTENT');
});

test('requires: storyBlock is refused in format 4, suite is needed, and the suite version is still checked', () => {
    refused(world({ requires: { storyBlock: '^2' } }), 'BAD_REQUIRES');
    refused(world({ requires: { suite: '^0.1', storyBlock: '^2' } }), 'BAD_REQUIRES');
    const none = refused(world({ requires: {} }), 'BAD_REQUIRES');
    assert.match(messageAt(none, 'requires.suite'), /requires\.suite/);
    refused(world({ requires: { suite: '^9' } }), 'HOST_VERSION');
    assert.equal(validatePack(pack({ format: 3, requires: { storyBlock: '^2' } })).ok, true, 'format 3 still reads storyBlock');
});

test('recommends: a world pack may suggest one game { id, version }; hostile shapes are refused', () => {
    assert.deepEqual(ok(world({ recommends: { game: { id: 'ers-rules', version: '^1' } } })).pack.recommends, { game: { id: 'ers-rules', version: '^1' } });
    assert.equal('recommends' in ok(world()).pack, false);
    const hostile = [null, 'g', [], 5, {}, { game: null }, { game: [] }, { game: {} }, { game: { id: 'g' } }, { game: { version: '^1' } }, { game: { id: 'G!', version: '^1' } }, { game: { id: 'g', version: 'banana' } },
        { game: { id: 'g', version: 1 } }, { game: { id: 'g', version: '^1', extra: 1 } }, { game: { id: 'g', version: '^1' }, world: { id: 'w' } }, { game: { id: 'chat'.repeat(20), version: '^1' } }];
    for (const bad of hostile) assert.equal(validatePack(world({ recommends: bad })).ok, false, JSON.stringify(bad));
    refused(game({ recommends: { game: { id: 'g', version: '^1' } } }), 'UNKNOWN_FIELD');
});

test('a world pack: the world checks run on it (a bad place is refused; the cast is the world cast)', () => {
    ok(world({ content: { regions: [{ id: 'r', name: 'R' }], places: [{ id: 'a', name: 'A', region: 'r', kind: 'town', x: 0, y: 0 }], cast: [{ id: 'ana', kind: 'figure', name: 'Ana' }] } }));
    refused(world({ content: { places: [{ id: 'a', name: 'A', x: 'far' }] } }), 'BAD_RECORD');
    // A format 3 style cast (no `kind`) is not a format 4 cast: the person is refused alone, with a warning, as a bad world cast person is.
    const old = ok(world({ content: { cast: [{ id: 'ana', name: 'Ana', look: 'Tall.' }, { id: 'bo', kind: 'figure', name: 'Bo' }] } }));
    assert.deepEqual(old.pack.content.cast.map(person => person.id), ['bo']);
    assert.ok(old.warnings.some(warning => warning.path === 'content.cast[0].kind'));
    const start = ok(world({ content: { start: { world: { set: [], facts: [] } } } })).pack.start;
    assert.deepEqual(start, { world: { set: [], facts: [] } });
});

test('a game pack: money, names, rank, trackers and RPG rules are checked; calendar, weather, start and pacing are only shape-checked for now', () => {
    const coins = { name: 'mark', plural: 'marks', coins: [{ name: 'mark', plural: 'marks', value: 1 }] };
    const result = ok(game({ content: { currency: coins, economy: { scale: 2 }, you: { rank: { label: 'Rank' } } } }));
    assert.equal(result.pack.currency.name, 'mark');
    assert.equal(result.pack.economy.scale, 2);
    assert.deepEqual(result.pack.content.you, { rank: { label: 'Rank' } });
    assert.equal(refused(game({ content: { currency: 'gold' } }), 'BAD_CURRENCY').errors[0].path, 'content.currency');
    assert.equal(validatePack(game({ content: { economy: { scale: 99999 } } })).ok, false);
    const later = ok(game({ content: { calendar: { months: [{ name: 'A', days: 30 }] }, weather: {}, start: {}, pacing: {} } }));
    assert.deepEqual(later.warnings.map(warning => warning.path).sort(), ['content.calendar', 'content.pacing', 'content.start', 'content.weather']);
    assert.equal(later.pack.calendar, null);
    for (const key of ['calendar', 'weather', 'start', 'pacing']) refused(game({ content: { [key]: 'x' } }), 'BAD_CONTENT');
    for (const key of ['calendar', 'weather', 'start', 'pacing']) refused(game({ content: { [key]: [] } }), 'BAD_CONTENT');
});

test('hostile files: prototype keys and deep or huge values are refused, and format 3 packs are read as before', () => {
    assert.equal(validatePack('{"id":"w","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"__proto__":{"x":1}}}').ok, false);
    assert.equal(validatePack(JSON.stringify(world({ name: 'x'.repeat(81) }))).ok, false);
    assert.equal(validatePack(JSON.stringify(world({ description: 5 }))).ok, false);
    const legacy = pack({ format: 3, requires: { suite: '^0.1' }, currency: { name: 'mark', plural: 'marks', coins: [{ name: 'mark', plural: 'marks', value: 1 }] }, content: { events: [] } });
    const result = ok(legacy);
    assert.equal(result.pack.format, 3);
    assert.equal('kind' in result.pack, false);
    assert.equal(result.pack.currency.name, 'mark');
});
