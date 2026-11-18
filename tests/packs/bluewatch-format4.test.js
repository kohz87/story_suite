// The Bluewatch starter in pack format 4 (job C2, the re-pin the owner approved with the format 4 questions, number 6): tests/fixtures/director/ersveil-bluewatch.pack.json (the world)
// and ersveil-bluewatch.game.json are what scripts/packs/convert-3to4.mjs makes of the old fixture, kept beside this as tests/fixtures/packs/ersveil-bluewatch-1/pack.json. The
// places, routes, items, calendar, money and start are the old ones; the legacy events, quests, creatures, shops, recipes, races, talents, skills and presets have no format 4 home.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { checkPairing, validatePack } from '../../packs/validate.js';
import { createInstalled } from '../../packs/installed.js';
import { mergeStart, calendarOf } from '../../packs/content.js';
import { convertText } from '../../scripts/packs/convert-3to4.mjs';
import { BLUEWATCH_GAME, BLUEWATCH_WORLD } from '../fixtures/director/bluewatch.js';
import { fakeSettings } from './helpers/fake-settings.js';

const OLD_PATH = 'tests/fixtures/packs/ersveil-bluewatch-1/pack.json';
const OLD = JSON.parse(readFileSync(new URL(`../../${OLD_PATH}`, import.meta.url), 'utf8'));
const WORLD = JSON.parse(BLUEWATCH_WORLD);
const GAME = JSON.parse(BLUEWATCH_GAME);

test('the pinned pair is exactly what the converter makes of the old fixture (the old file is never edited)', () => {
    const made = convertText(readFileSync(new URL(`../../${OLD_PATH}`, import.meta.url), 'utf8'), {}, OLD_PATH);
    assert.equal(made.world, BLUEWATCH_WORLD);
    assert.equal(made.game, BLUEWATCH_GAME);
    assert.equal(OLD.format, undefined, 'the old fixture is the unversioned shape');
    assert.deepEqual([WORLD.id, WORLD.format, WORLD.kind, WORLD.version, GAME.id, GAME.kind, WORLD.recommends.game.id], ['ersveil-bluewatch', 4, 'world', '4.0.0', 'ersveil-bluewatch-game', 'game', 'ersveil-bluewatch-game']);
});

test('what format 4 holds is the old data: places, routes and items by name, and the calendar, money and start', () => {
    const { places, routes, items } = WORLD.content;
    assert.deepEqual(places.map(({ name, x, y }) => [name, x, y]), OLD.content.places.map(({ name, x, y }) => [name, x, y]));
    assert.deepEqual(routes.map(({ from, to, km }) => [from, to, km]), OLD.content.routes.map(({ from, to, km }) => [from, to, km]));
    assert.deepEqual(items, OLD.content.items);
    assert.deepEqual(Object.keys(WORLD.content).sort(), ['items', 'placeKinds', 'places', 'routeKinds', 'routes', 'start']);
    assert.deepEqual(GAME.content.calendar.months, OLD.calendar.months);
    assert.deepEqual(GAME.content.currency, OLD.currency);
    assert.equal(GAME.content.start.money, 44);
    assert.deepEqual(GAME.content.start.items.map(item => item.name), OLD.start.inventory.items.map(item => item.item));
    assert.deepEqual(WORLD.content.start, { date: { era: 'CY', year: 611, month: 5, day: 12, hour: 6, minute: 40 }, place: 'bluewatch-village' });
});

test('both pass the checker and pair with no problem; installed, both are selected and the chat starts at Bluewatch Village on 12 Goldwane CY 611, 06:40', async () => {
    for (const [name, text] of [['world', BLUEWATCH_WORLD], ['game', BLUEWATCH_GAME]]) {
        const result = checkPack(text);
        assert.equal(result.ok, true, report(name, result));
    }
    assert.equal(checkPairing(validatePack(BLUEWATCH_WORLD).pack, validatePack(BLUEWATCH_GAME).pack).errors.length, 0);
    const installed = createInstalled({ settings: fakeSettings() });
    for (const text of [BLUEWATCH_WORLD, BLUEWATCH_GAME]) assert.equal((await installed.install(text)).ok, true);
    assert.deepEqual(installed.selected(), { world: 'ersveil-bluewatch', game: 'ersveil-bluewatch-game' });
    const start = mergeStart(installed.packs());
    assert.equal(start.scene.place.name, 'Bluewatch Village');
    assert.equal(start.inventory.money, 44);
    assert.deepEqual(start.problems, []);
    assert.deepEqual(calendarOf(installed.packs()).start, { year: 611, month: 'Goldwane', day: 12, hour: 6, minute: 40 });
});
