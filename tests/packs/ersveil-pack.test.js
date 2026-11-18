// The shipped Ersveil in pack format 4 (job C1): the world pack examples/packs/ersveil (4.0.0) and its game pack examples/packs/ersveil-game (1.0.0) are what
// scripts/packs/convert-3to4.mjs makes of examples/packs/ersveil-world, byte for byte; both pass the checker and the install check with the capabilities their kind
// needs; they pair with no problem; installed together they start a chat at the Guild Office on 1 October CY 611 with 40 copper. The old format 3 Ersveil (2.x,
// with its lorebook) is a frozen test fixture now, tests/fixtures/packs/ersveil-3, read by the format 3 tests until X1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { validatePack, checkPairing } from '../../packs/validate.js';
import { createInstalled } from '../../packs/installed.js';
import { mergeStart, calendarOf } from '../../packs/content.js';
import { convert3to4 } from '../../scripts/packs/convert-3to4-parts/convert.js';
import { ersveilFiles } from '../../scripts/packs/convert-3to4.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';
import { fakeSettings } from './helpers/fake-settings.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const at = rel => path.join(root, rel);
const text = rel => readFileSync(at(rel), 'utf8');
const WORLD = 'examples/packs/ersveil/pack.json';
const GAME = 'examples/packs/ersveil-game/pack.json';
const WORLD_CAPS = ['scene', 'chronicle-lasting'];
const GAME_CAPS = ['scene', 'inventory', 'data-modules-v1'];

test('the folders: the world pack, its conversion notes and the twelve portraits of the source; the game pack alone; the old Ersveil is a fixture', () => {
    assert.deepEqual(readdirSync(at('examples/packs/ersveil')).sort(), ['CONVERSION-NOTES.md', 'pack.json', 'portraits']);
    assert.deepEqual(readdirSync(at('examples/packs/ersveil-game')), ['pack.json']);
    const portraits = readdirSync(at('examples/packs/ersveil/portraits')).sort();
    assert.deepEqual(portraits, readdirSync(at('examples/packs/ersveil-world/portraits')).sort());
    for (const name of portraits) assert.ok(readFileSync(at(`examples/packs/ersveil/portraits/${name}`)).equals(readFileSync(at(`examples/packs/ersveil-world/portraits/${name}`))), name);
    assert.equal(JSON.parse(text('tests/fixtures/packs/ersveil-3/pack.json')).format, 3);
    assert.ok(existsSync(at('tests/fixtures/packs/ersveil-3/ersveil-lore.json')) && existsSync(at('tests/fixtures/packs/ersveil-3/ersveil.zip')));
});

test('the shipped files are exactly what the converter makes of the source (run `node scripts/packs/convert-3to4.mjs --ersveil` after a change)', () => {
    const files = ersveilFiles();
    assert.deepEqual(files.map(file => file.path).filter(rel => !rel.includes('/portraits/')), [WORLD, 'examples/packs/ersveil/CONVERSION-NOTES.md', GAME]);
    for (const file of files) assert.ok(readFileSync(at(file.path)).equals(file.bytes), `${file.path} is not what the converter builds`);
    const printed = execFileSync(process.execPath, ['scripts/packs/convert-3to4.mjs', '--ersveil', '--check'], { cwd: root, encoding: 'utf8' });
    assert.match(printed, /Ersveil is up to date/);
});

test('both pass the authoring-kit checker, in code and on the command line', () => {
    for (const rel of [WORLD, GAME]) {
        const result = checkPack(text(rel));
        assert.equal(result.ok, true, report(rel, result));
        assert.match(execFileSync(process.execPath, ['authoring-kit/check.mjs', rel], { cwd: root, encoding: 'utf8' }), new RegExp(`^OK ${rel.replaceAll('/', '\\/').replaceAll('.', '\\.')}\\n`));
    }
});

test('the install check accepts each with its kind\'s capabilities and nothing more, with no warning; each is refused without one, or on a suite older than 0.1', () => {
    for (const [rel, kind, caps] of [[WORLD, 'world', WORLD_CAPS], [GAME, 'game', GAME_CAPS]]) {
        const good = validatePack(text(rel), { capabilities: caps });
        assert.equal(good.ok, true, JSON.stringify(good.errors));
        assert.equal(good.pack.kind, kind);
        assert.deepEqual(good.warnings ?? [], []);
        for (const missing of caps) {
            const bare = validatePack(text(rel), { capabilities: caps.filter(name => name !== missing) });
            assert.ok(!bare.ok && bare.errors.some(error => error.code === 'MISSING_CAPABILITY'), `${kind} without ${missing}`);
        }
        const old = validatePack(text(rel), { capabilities: caps, suiteVersion: '0.0.9' });
        assert.ok(!old.ok && old.errors.some(error => error.code === 'HOST_VERSION'), kind);
    }
});

test('the pair has no pairing problem; with the built-in game only the recommendation line', () => {
    const world = validatePack(text(WORLD)).pack;
    const game = validatePack(text(GAME)).pack;
    assert.deepEqual(checkPairing(world, game), { errors: [], warnings: [], info: [] });
    const builtIn = checkPairing(world, null);
    assert.deepEqual([builtIn.errors, builtIn.warnings, builtIn.info.map(line => line.code)], [[], [], ['PAIR_RECOMMENDS']]);
});

test('installed together: both selected; the chat starts at the Guild Office on 1 October CY 611, 07:00, with 40 copper and the game\'s calendar', async () => {
    const settings = fakeSettings();
    const installed = createInstalled({ settings });
    for (const rel of [WORLD, GAME]) assert.equal((await installed.install(text(rel))).ok, true, rel);
    assert.deepEqual(installed.selected(), { world: 'ersveil', game: 'ersveil-game' });
    const start = mergeStart(installed.packs());
    assert.deepEqual(start.scene.place, { name: 'Bluewatch Village / Guild Office', kind: 'guild office', region: 'Bluewatch Reach' });
    assert.equal(start.inventory.money, 40);
    assert.deepEqual(start.currency.coins.map(coin => [coin.name, coin.value]), [['copper', 1], ['silver', 10], ['gold', 100]]);
    assert.deepEqual(start.problems, []);
    const calendar = calendarOf(installed.packs());
    assert.deepEqual([calendar.pack, calendar.era, calendar.months.length, calendar.start], ['ersveil-game', 'CY', 12, { year: 611, month: 'October', day: 1, hour: 7, minute: 0 }]);
});

test('the converter on any format 3 pack: the command line writes both packs and the notes; what has no format 4 home is listed as dropped', () => {
    const out = tempDir('convert-3to4-');
    try {
        execFileSync(process.execPath, ['scripts/packs/convert-3to4.mjs', 'examples/packs/ersveil-world/pack.json', out], { cwd: root, encoding: 'utf8' });
        const world = JSON.parse(readFileSync(path.join(out, 'world/pack.json'), 'utf8'));
        const game = JSON.parse(readFileSync(path.join(out, 'game/pack.json'), 'utf8'));
        assert.deepEqual([world.version, game.id, game.version, game.name], ['4.0.0', 'ersveil-game', '1.0.0', 'Ersveil (open world) rules']);
        assert.ok(world.content.regions.every(region => !('climate' in region)), 'no preset: no climate proposed');
        assert.equal(checkPairing(validatePack(world).pack, validatePack(game).pack).errors.length, 0);
        assert.match(readFileSync(path.join(out, 'CONVERSION-NOTES.md'), 'utf8'), /\| `bluewatch-reach` \(Bluewatch Reach\) \| none \(temperate\) \| not in the proposals \|/);
    } finally { rmSync(out, { recursive: true, force: true }); }
    const legacy = convert3to4({
        id: 'old', format: 3, version: '2.1.0', name: 'Old', requires: { suite: '^0.1', capabilities: ['inventory'] }, ripples: {}, theme: {},
        calendar: { months: [{ name: 'Moon', days: 28 }], era: 'AE' }, start: { scene: { place: { name: 'Nowhere' }, present: ['Ann'] }, inventory: { money: 5, items: [{ name: 'Rope', qty: 2 }] } },
        content: { places: [{ id: 'dock', name: 'Dock', x: 1, y: 1 }], events: [{ id: 'e' }], skills: [{ name: 'Jab' }], cast: [{ id: 'ann', name: 'Ann' }] },
    });
    assert.deepEqual(legacy.notes.dropped, ['start.scene.place "Nowhere" was not one of the pack\'s places: it is added as a place, the world\'s start place', 'content.events', 'content.skills', 'content.cast in the format 3 shape (no `kind`): a world cast is needed',
        'start.scene.present (the cast\'s own start.place places people)', 'ripples', 'theme']);
    assert.deepEqual(Object.keys(legacy.world.content), ['places', 'start']);
    assert.deepEqual(legacy.world.content.places.map(place => place.id), ['dock', 'nowhere'], 'the start place is a place of the world');
    assert.equal(legacy.world.content.start.place, 'nowhere');
    assert.deepEqual(legacy.world.requires, { suite: '^0.1' });
    assert.deepEqual(legacy.game.content, { calendar: { months: [{ name: 'Moon', days: 28 }], era: 'AE' }, start: { money: 5, items: [{ name: 'Rope', qty: 2 }] } });
    assert.equal(validatePack(legacy.game).ok, true, 'the era stays in the game calendar when the world has no start date');
});
