// The Studio's parts table and its use of the game's pack checker: what each part shows, where a problem goes, and that the
// Studio's verdict is packs/validate.js's own (same ok, same codes and paths), for a format 3 pack and a world pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../../packs/validate.js';
import { checkText } from '../../../studio/check.js';
import { PARTS, partOfPath, partsOf } from '../../../studio/parts.js';

const read = rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const ERSVEIL = read('tests/fixtures/packs/ersveil-3/pack.json');
const TINY = read('authoring-kit/examples/tiny-world/pack.json');
const WORLD = read('tests/packs/studio/fixtures/world-mini.json');
const ERSVEIL_WORLD = read('examples/packs/ersveil-world/pack.json');

test('every part has an id, a name, a group the nav knows and an icon; ids and content kinds are unique', () => {
    const ids = PARTS.map(part => part.id);
    assert.equal(new Set(ids).size, ids.length);
    const keys = PARTS.flatMap(part => part.keys);
    assert.equal(new Set(keys).size, keys.length);
    for (const part of PARTS) {
        assert.ok(part.name && part.icon && part.desc, part.id);
        assert.ok(['Pack', 'World', 'Check'].includes(part.group), part.id);
    }
});

test('a format 3 pack shows its own parts, with counts, plus Overview and Problems', () => {
    const parts = partsOf(JSON.parse(ERSVEIL));
    assert.deepEqual(parts.map(part => part.id), ['overview', 'cast', 'map', 'events', 'items', 'other', 'problems']);
    const cast = parts.find(part => part.id === 'cast');
    assert.equal(cast.count, 12);
    const other = parts.find(part => part.id === 'other');
    assert.deepEqual(other.sections.map(section => section.key), ['you', 'dataModules', 'rpg', 'names', 'currency', 'calendar', 'weather', 'ripples', 'start']);
});

test('a world pack shows lore, the map parts, conditions with the starting world, events, templates and powers', () => {
    const parts = partsOf(JSON.parse(WORLD));
    assert.deepEqual(parts.map(part => part.id), ['overview', 'lore', 'cast', 'map', 'conditions', 'events', 'templates', 'powers', 'problems']);
    const map = parts.find(part => part.id === 'map');
    assert.deepEqual(map.sections.map(section => [section.key, section.count]), [['places', 3], ['routes', 2], ['regions', 2], ['realms', 1], ['placeKinds', 2], ['routeKinds', 1]]);
    assert.deepEqual(parts.find(part => part.id === 'conditions').sections.map(section => section.key), ['conditions', 'start']);
});

test('no pack, or a pack that is not an object, still has Overview and Problems', () => {
    assert.deepEqual(partsOf(null).map(part => part.id), ['overview', 'problems']);
    assert.deepEqual(partsOf([1, 2]).map(part => part.id), ['overview', 'problems']);
});

test('a checker path goes to its part and record', () => {
    assert.deepEqual(partOfPath('content.cast[3].secrets[1].gate'), { part: 'cast', rec: 'cast.3' });
    assert.deepEqual(partOfPath('content.lore'), { part: 'lore', rec: null });
    assert.deepEqual(partOfPath('content.worldEvents[0].requires'), { part: 'events', rec: 'worldEvents.0' });
    assert.deepEqual(partOfPath('content.start'), { part: 'conditions', rec: null });
    assert.deepEqual(partOfPath('content.dataModules[2]'), { part: 'other', rec: 'dataModules.2' });
    assert.deepEqual(partOfPath('requires.storyBlock'), { part: 'overview', rec: null });
    assert.deepEqual(partOfPath('calendar.months'), { part: 'other', rec: null });
    assert.deepEqual(partOfPath(''), { part: 'overview', rec: null });
});

for (const [name, text] of [['Ersveil', ERSVEIL], ['tiny-world', TINY], ['the world-pack fixture', WORLD], ['the sample world pack', ERSVEIL_WORLD], ['text that is not JSON', '{ nope']]) {
    test(`the Studio's verdict on ${name} is the pack checker's own`, () => {
        const game = validatePack(text);
        const studio = checkText(text);
        assert.equal(studio.ok, game.ok);
        assert.deepEqual(studio.errors.map(e => [e.code, e.path, e.message]), (game.errors ?? []).map(e => [e.code, e.path, e.message]));
        assert.deepEqual(studio.warnings.map(w => [w.code, w.path]), (game.warnings ?? []).map(w => [w.code, w.path]));
        assert.equal(studio.total, studio.errors.length + studio.warnings.length);
    });
}

test('Ersveil and the sample world pack pass; the engine knows the world-pack kinds, and the fixture\'s other problems are filed under their parts', () => {
    assert.equal(checkText(ERSVEIL).ok, true);
    assert.equal(checkText(ERSVEIL_WORLD).ok, true);
    const world = checkText(WORLD);
    const codes = world.errors.map(e => [e.code, e.path]);
    for (const kind of ['lore', 'regions', 'realms', 'placeKinds', 'routeKinds', 'conditions', 'worldEvents', 'templates', 'powers', 'scores']) {
        assert.ok(!codes.some(([code, path]) => code === 'UNKNOWN_KIND' && path === `content.${kind}`), kind);
    }
    // The checker refuses the fixture's content.start, its event's cue and its missing ends_when; each problem is filed under its part.
    assert.equal(world.ok, false);
    const filed = world.errors.map(e => [e.code, e.path, e.part, e.rec]);
    assert.ok(filed.some(([code, path, part]) => code === 'UNKNOWN_KIND' && path === 'content.start' && part === 'conditions'));
    assert.ok(filed.some(([code, path, part, rec]) => code === 'UNKNOWN_FIELD' && path === 'content.worldEvents[0].cue' && part === 'events' && rec === 'worldEvents.0'));
    assert.ok(world.byPart.events.some(e => e.rec === 'worldEvents.0' && e.code === 'BAD_RECORD'));
    assert.ok(world.byPart.conditions.some(e => e.rec === 'conditions.1' && e.code === 'NO_CLEARING_PATH'));
    assert.deepEqual(checkText('{ nope').byPart.overview.map(e => e.code), ['NOT_JSON']);
});
