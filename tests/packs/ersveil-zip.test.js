// examples/packs/ersveil.zip (built by scripts/core/build-example-zip.mjs) can never drift from the format 4 Ersveil: pack.json is the world pack
// (examples/packs/ersveil), the portraits are its folder's byte for byte, game.json is the game pack (examples/packs/ersveil-game), and the conversion notes
// ride along; Story Block's readPackZip reads it, importing it installs both packs (selected only when no world or game was chosen before), and rebuilding gives
// the same bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readPackZip } from '../../packs/bundle.js';
import { createPacksPart } from '../../packs/index.js';
import { importPicked } from '../../packs/import-run.js';
import { readZip } from '../../packs/zip.js';
import { buildErsveilZip } from '../../scripts/core/build-example-zip.mjs';
import { fakeSettings } from './helpers/fake-settings.js';
import { fakeFiles } from './helpers/portraits.js';

const packs = new URL('../../examples/packs/', import.meta.url);
const folder = new URL('ersveil/', packs);
const zipBytes = () => new Uint8Array(readFileSync(new URL('ersveil.zip', packs)));
const bytesOf = path => new Uint8Array(readFileSync(new URL(path, folder)));
const zipFile = () => {
    const bytes = zipBytes();
    return { name: 'ersveil.zip', type: 'application/zip', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};

test('the shipped zip is exactly what the build script gives (run `node scripts/core/build-example-zip.mjs` when a pack, the notes or a portrait changes)', () => {
    assert.ok(Buffer.from(zipBytes()).equals(Buffer.from(buildErsveilZip())), 'examples/packs/ersveil.zip is out of date');
});

test('the zip lists pack.json first, then portraits/<file> for the twelve pictures, then game.json and CONVERSION-NOTES.md, and nothing else', () => {
    const names = readZip(zipBytes()).map(entry => entry.name);
    const portraits = readdirSync(new URL('portraits/', folder)).sort();
    assert.equal(portraits.length, 12);
    assert.equal(names[0], 'pack.json');
    assert.deepEqual(names.slice(-2), ['game.json', 'CONVERSION-NOTES.md']);
    assert.deepEqual(names.slice(1, -2).sort(), portraits.map(name => `portraits/${name}`));
});

test('its pack.json, game.json and every portrait are the files in the repo, byte for byte', async () => {
    const read = await readPackZip(zipBytes());
    assert.equal(read.ok, true, read.message);
    assert.equal(read.text, readFileSync(new URL('pack.json', folder), 'utf8'));
    assert.equal(read.game, readFileSync(new URL('ersveil-game/pack.json', packs), 'utf8'));
    assert.deepEqual(read.files.map(file => file.name).sort(), readdirSync(new URL('portraits/', folder)).sort());
    for (const file of read.files) {
        const real = bytesOf(`portraits/${file.name}`);
        assert.equal(file.size, real.length, file.name);
        assert.ok(Buffer.from(await file.read()).equals(Buffer.from(real)), `${file.name} differs from the file in the folder`);
    }
});

test('importing the shipped zip into a fresh store installs the world and its game and selects both: twelve portraits saved, 31 people, the game\'s data modules', async () => {
    const portraitFiles = fakeFiles();
    const made = createPacksPart({ settings: fakeSettings(), portraitFiles });
    const result = await importPicked(made.packs, [zipFile()]);
    assert.deepEqual(result.errors, []);
    assert.equal(result.text, 'Installed Ersveil (open world). Installed Ersveil rules (its game pack). 12 portraits saved.');
    assert.equal(portraitFiles.files.size, 12);
    const list = made.packs.list();
    assert.deepEqual(list.map(entry => [entry.id, entry.kind, entry.enabled]), [['ersveil', 'world', true], ['ersveil-game', 'game', true]]);
    assert.equal(list[0].counts.cast, 31);
    assert.equal(list[1].counts.dataModules, 3);
    assert.deepEqual(made.packs.selected(), { world: 'ersveil', game: 'ersveil-game' });
});

test('importing it where a world and a game are already chosen installs both and keeps the choice (the zip import does not select)', async () => {
    const made = createPacksPart({ settings: fakeSettings(), portraitFiles: fakeFiles() });
    const requires = { suite: '^0.1' };
    for (const pack of [{ id: 'w1', format: 4, kind: 'world', version: '1.0.0', requires, content: { places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }] } },
        { id: 'g1', format: 4, kind: 'game', version: '1.0.0', requires, content: { currency: { name: 'mark', coins: [{ name: 'mark', value: 1 }] } } }]) assert.equal((await made.packs.install(pack)).ok, true, pack.id);
    assert.deepEqual(made.packs.selected(), { world: 'w1', game: 'g1' });
    const result = await importPicked(made.packs, [zipFile()]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(made.packs.list().map(entry => entry.id), ['w1', 'g1', 'ersveil', 'ersveil-game']);
    assert.deepEqual(made.packs.selected(), { world: 'w1', game: 'g1' });
});
