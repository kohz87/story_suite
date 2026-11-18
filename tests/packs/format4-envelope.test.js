// Pack format 4, the envelope (job P1): `format` 4 with `kind` "world" or "game", `recommends`, the top-level fields, the `content` keys of each kind with their "belongs in a … pack" pointers.
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

test('format: a missing, 1, 2 or 3 format is FORMAT_OLD alone; a non-integer is BAD_FIELD; a newer number is FORMAT_NEWER', () => {
    for (const old of [undefined, 0, -1, 1, 2, 3]) {   // (0 and -1: REVPF4 18, an old format too, not BAD_FIELD)
        const input = world({ format: old });
        if (old === undefined) delete input.format;
        const result = refused(input, 'FORMAT_OLD');
        assert.equal(result.errors.length, 1, `format ${old}`);
        assert.equal(result.errors[0].path, 'format');
    }
    for (const bad of [4.5, '3', null]) {
        const result = refused(world({ format: bad }), 'BAD_FIELD');
        assert.equal(result.errors[0].path, 'format');
        assert.equal(codes(result).includes('FORMAT_OLD'), false, JSON.stringify(bad));
    }
    refused(world({ format: 5 }), 'FORMAT_NEWER');
    // An old pack is not read at all: the old fields it carries are not reported on top.
    assert.equal(refused(pack({ format: 3, requires: { storyBlock: '^2' }, currency: {} }), 'FORMAT_OLD').errors.length, 1);
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
    // REVPF4 18: a key that is an inherited name ("toString") reads as unknown, not as a moved field
    assert.match(messageAt(refused(world({ toString: 1 }), 'UNKNOWN_FIELD'), 'toString'), /"toString" is not a pack field \(expected /);
    assert.match(messageAt(refused(world({ content: { toString: [] } }), 'UNKNOWN_KIND'), 'content.toString'), /is not a content key of a world pack/);
    assert.match(messageAt(refused(world({ content: { start: { toString: 1 } } }), 'UNKNOWN_FIELD'), 'content.start.toString'), /is not a world start field \([^)]*\)\.$/);
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

test('a game pack: money, names, rank, trackers and RPG rules are checked; calendar, weather, start and pacing are refused when not objects', () => {
    const coins = { name: 'mark', plural: 'marks', coins: [{ name: 'mark', plural: 'marks', value: 1 }] };
    const result = ok(game({ content: { currency: coins, economy: { scale: 2 }, you: { rank: { label: 'Rank' } } } }));
    assert.equal(result.pack.currency.name, 'mark');
    assert.equal(result.pack.economy.scale, 2);
    assert.deepEqual(result.pack.content.you, { rank: { label: 'Rank' } });
    assert.equal(refused(game({ content: { currency: 'gold' } }), 'BAD_CURRENCY').errors[0].path, 'content.currency');
    assert.equal(validatePack(game({ content: { economy: { scale: 99999 } } })).ok, false);
    // The calendar, weather, start and pacing sections are checked by format4-game.test.js; here only that a wrong type is refused.
    for (const key of ['calendar', 'weather', 'start', 'pacing']) refused(game({ content: { [key]: 'x' } }), key === 'calendar' ? 'BAD_CALENDAR' : key === 'weather' ? 'BAD_WEATHER' : key === 'start' ? 'BAD_START' : 'BAD_CONTENT');
});

test('hostile files: prototype keys and deep or huge values are refused', () => {
    assert.equal(validatePack('{"id":"w","format":4,"kind":"world","version":"1.0.0","requires":{"suite":"^0.1"},"content":{"__proto__":{"x":1}}}').ok, false);
    assert.equal(validatePack(JSON.stringify(world({ name: 'x'.repeat(81) }))).ok, false);
    assert.equal(validatePack(JSON.stringify(world({ description: 5 }))).ok, false);
});

test('recommends.game may name the game (SFF4 #11): kept trimmed, a blank name left out, a long or non-text name refused', () => {
    assert.deepEqual(ok(world({ recommends: { game: { id: 'ers-rules', version: '^1', name: '  Ersveil   rules ' } } })).pack.recommends, { game: { id: 'ers-rules', version: '^1', name: 'Ersveil rules' } });
    assert.deepEqual(ok(world({ recommends: { game: { id: 'ers-rules', version: '^1', name: ' ' } } })).pack.recommends, { game: { id: 'ers-rules', version: '^1' } });
    for (const name of [5, null, 'x'.repeat(81)]) assert.equal(validatePack(world({ recommends: { game: { id: 'g', version: '^1', name } } })).ok, false, String(name));
});
