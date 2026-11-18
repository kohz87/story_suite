// The Studio's parts table and its use of the game's pack checker: what each part shows per pack kind, where a problem goes, that
// every content key of each format 4 kind has a part and an editor slot, and that the Studio's verdict is packs/validate.js's own
// (same ok, same codes and paths), for format 3 packs, a world-spec pack and format 4 world and game packs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validatePack } from '../../../packs/validate.js';
import { CONTENT_KEYS } from '../../../packs/limits-parts/kinds.js';
import { checkText } from '../../../studio/check.js';
import { PARTS, kindOf, partOfPath, partsOf } from '../../../studio/parts.js';
import { EDITORS, PAGES } from '../../../studio/views/route.js';

const read = rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const ERSVEIL = read('examples/packs/ersveil/pack.json');
const TINY = read('authoring-kit/examples/tiny-world/pack.json');
const WORLD = read('tests/packs/studio/fixtures/world-mini.json');
const ERSVEIL_WORLD = read('examples/packs/ersveil-world/pack.json');
const WORLD4 = read('tests/packs/studio/fixtures/world4-mini.json');
const GAME4 = read('tests/packs/studio/fixtures/game4-mini.json');

test('every part has an id, a name, a group the nav knows and an icon; ids are unique, and each kind groups a key once', () => {
    const ids = PARTS.map(part => part.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const kind of ['world', 'game']) {
        const keys = PARTS.filter(part => part.kind === kind).flatMap(part => part.keys);
        assert.equal(new Set(keys).size, keys.length, kind);
    }
    for (const part of PARTS) {
        assert.ok(part.name && part.icon && part.desc, part.id);
        assert.ok(['Pack', 'World', 'Game', 'Check'].includes(part.group), part.id);
        assert.ok([null, 'world', 'game'].includes(part.kind), part.id);
    }
    assert.deepEqual(PARTS.filter(part => part.group === 'Game').map(part => part.name), ['Calendar', 'Money', 'Weather', 'Names', 'Rules', 'Trackers', 'Start']);
});

test('every content key of each format 4 kind has a part of that kind and an editor slot; every slot file exists', () => {
    for (const kind of ['world', 'game']) {
        const content = Object.fromEntries(CONTENT_KEYS[kind].map(key => [key, []]));
        const parts = partsOf({ format: 4, kind, content });
        for (const key of CONTENT_KEYS[kind]) {
            const part = parts.find(item => item.sections.some(section => section.key === key));
            assert.ok(part && part.kind === kind, `${kind} ${key} in a ${kind} part`);
            assert.equal(partOfPath(`content.${key}[0]`, kind).part, part.id, `${kind} ${key} problems`);
            assert.ok(EDITORS[kind][key], `${kind} ${key} editor`);
        }
    }
    const editors = new Set([...Object.values(EDITORS.top), ...Object.values(EDITORS.world), ...Object.values(EDITORS.game)]);
    assert.equal(editors.size, 20);
    for (const name of editors) assert.ok(existsSync(new URL(`../../../studio/edit/${name}.js`, import.meta.url)), name);
    for (const [id, page] of Object.entries(PAGES)) assert.ok(existsSync(new URL(`../../../studio/${page.file}`, import.meta.url)), id);
    for (const part of PARTS.filter(item => item.page)) assert.equal(PAGES[part.page].part, part.id);
});

test('the kind of a pack: format 4 says it; anything older (or no format) is format 3, read-only in the world slot', () => {
    assert.deepEqual(kindOf(JSON.parse(WORLD4)), { kind: 'world', legacy: false });
    assert.deepEqual(kindOf(JSON.parse(GAME4)), { kind: 'game', legacy: false });
    assert.deepEqual(kindOf(JSON.parse(ERSVEIL)), { kind: 'world', legacy: true });
    assert.deepEqual(kindOf(JSON.parse(WORLD)), { kind: 'world', legacy: true });
    assert.deepEqual(kindOf(null), { kind: 'world', legacy: true });
    // A format 4 pack whose kind is wrong is not a format 3 pack: it goes to the world slot, editable, and the checker says BAD_KIND.
    assert.deepEqual(kindOf({ format: 4, kind: 'both' }), { kind: 'world', legacy: false });
});

test('a format 4 world and game show their own kind\'s parts; a key of the other kind (or none) goes to Other', () => {
    assert.deepEqual(partsOf(JSON.parse(WORLD4)).map(part => part.id), ['overview', 'lore', 'cast', 'map', 'conditions', 'powers', 'problems']);
    const game = partsOf(JSON.parse(GAME4));
    assert.deepEqual(game.map(part => part.id), ['overview', 'calendar', 'money', 'names', 'game-start', 'problems']);
    assert.deepEqual(game.find(part => part.id === 'overview').sections.map(section => section.key), ['id', 'format', 'kind', 'version', 'name', 'author', 'description', 'requires']);
    const mixed = partsOf({ format: 4, kind: 'world', id: 'w', extra: 1, content: { calendar: {}, events: [], lore: [] } });
    assert.deepEqual(mixed.find(part => part.id === 'other').sections.map(section => [section.key, section.where]), [['calendar', 'content'], ['events', 'content'], ['extra', 'top']]);
    assert.deepEqual(partsOf({ format: 4, kind: 'game', content: { lore: [], start: {} } }).map(part => part.id), ['overview', 'game-start', 'other', 'problems']);
});

test('a checker path in a format 4 pack goes to its kind\'s part', () => {
    assert.deepEqual(partOfPath('content.start.money', 'game'), { part: 'game-start', rec: null });
    assert.deepEqual(partOfPath('content.start', 'world'), { part: 'conditions', rec: null });
    assert.deepEqual(partOfPath('content.currency.coins', 'game'), { part: 'money', rec: null });
    assert.deepEqual(partOfPath('content.lore[0]', 'game'), { part: 'other', rec: 'lore.0' });
    assert.deepEqual(partOfPath('content.events[1]', 'world'), { part: 'other', rec: 'events.1' });
    assert.deepEqual(partOfPath('recommends.game', 'world'), { part: 'overview', rec: null });
    assert.deepEqual(partOfPath('calendar', 'game'), { part: 'other', rec: null });
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

for (const [name, text] of [['Ersveil', ERSVEIL], ['tiny-world', TINY], ['the world-pack fixture', WORLD], ['the sample world pack', ERSVEIL_WORLD], ['the format 4 world', WORLD4], ['the format 4 game', GAME4], ['text that is not JSON', '{ nope']]) {
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
