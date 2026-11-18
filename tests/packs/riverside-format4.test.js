// The riverside-starter fixture in pack format 4 (job C2): the world pack (items, a foe, the start place) and its game pack (the pennies, the money and the items you start with),
// made by scripts/packs/convert-3to4.mjs from the frozen format 3 copy tests/fixtures/packs/riverside-starter-3.json. The format 3 events, the theme and the scene's
// `present` have no format 4 home and are dropped; the start place, a place record in format 3, becomes a place of the world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { checkPairing, validatePack } from '../../packs/validate.js';
import { createInstalled } from '../../packs/installed.js';
import { mergeStart } from '../../packs/content.js';
import { convertText } from '../../scripts/packs/convert-3to4.mjs';
import { sampleText } from './helpers/fixtures.js';
import { fakeSettings } from './helpers/fake-settings.js';

const sampleWorldText = readFileSync(new URL('./fixtures/riverside-starter.json', import.meta.url), 'utf8');
const sampleGameText = readFileSync(new URL('./fixtures/riverside-starter.game.json', import.meta.url), 'utf8');

test('the format 4 pair is what the converter makes of the frozen format 3 copy, apart from the world description', () => {
    const made = convertText(sampleText, {}, 'tests/packs/fixtures/riverside-starter.json');
    const world = JSON.parse(sampleWorldText);
    assert.deepEqual({ ...JSON.parse(made.world), description: world.description }, world);
    assert.equal(sampleGameText, made.game);
    assert.match(world.description, /pack format 4/);
});

test('both pass the checker; they pair with no problem', () => {
    for (const [name, text] of [['world', sampleWorldText], ['game', sampleGameText]]) {
        const result = checkPack(text);
        assert.equal(result.ok, true, report(name, result));
    }
    const world = validatePack(sampleWorldText).pack;
    const game = validatePack(sampleGameText).pack;
    assert.deepEqual([world.kind, game.kind], ['world', 'game']);
    assert.equal(checkPairing(world, game).errors.length, 0);
});

test('installed together: the items resolve, the foe is there, and the chat starts at Bluewatch Village with 50 pennies and three things in hand', async () => {
    const installed = createInstalled({ settings: fakeSettings() });
    for (const text of [sampleWorldText, sampleGameText]) assert.equal((await installed.install(text)).ok, true);
    assert.deepEqual(installed.selected(), { world: 'riverside-starter', game: 'riverside-starter-game' });
    const start = mergeStart(installed.packs());
    assert.equal(start.scene.place.name, 'Bluewatch Village');
    assert.equal(start.inventory.money, 50);
    assert.equal(start.inventory.items.length, 3);
    assert.equal(start.currency.name, 'pennies');
    assert.deepEqual(start.problems, []);
});
