// The sample world pack (examples/packs/ersveil-world, Ersveil 3.0.0, the new world): its pack passes the authoring-kit checker and Story
// Block's install check with no errors, the twelve portraits are web size, and examples/packs/ersveil-world.zip is exactly what
// scripts/core/build-example-zip.mjs builds, reads back through the zip reader and installs. The old minimal pack (examples/packs/ersveil)
// is left alone: tests and fixtures pin it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { validatePack } from '../../packs/validate.js';
import { readPackZip } from '../../packs/bundle.js';
import { createPacksPart } from '../../packs/index.js';
import { readZip } from '../../packs/zip.js';
import { buildErsveilWorldZip } from '../../scripts/core/build-example-zip.mjs';
import { fakeSettings } from './helpers/fake-settings.js';
import { fakeFiles } from './helpers/portraits.js';

const packs = new URL('../../examples/packs/', import.meta.url);
const folder = new URL('ersveil-world/', packs);
const packText = readFileSync(new URL('pack.json', folder), 'utf8');
const pack = () => JSON.parse(packText);
const zipBytes = () => new Uint8Array(readFileSync(new URL('ersveil-world.zip', packs)));
const NAMES = ['asphodel', 'barney', 'gorm', 'harrak', 'hush', 'lothar', 'nerissa', 'nysseth', 'rika', 'temiwa', 'torka', 'ysmeth'];
const OPEN = ['scene', 'inventory', 'data-modules-v1', 'chronicle-lasting'];

test('the folder holds pack.json, README.md and twelve web-size WebP portraits the cast names (512 px at most, 150 KB at most)', () => {
    assert.deepEqual(readdirSync(folder).sort(), ['README.md', 'pack.json', 'portraits']);
    const files = readdirSync(new URL('portraits/', folder)).sort();
    assert.deepEqual(files, NAMES.map(name => `${name}.webp`));
    const named = pack().content.cast.map(person => person.portrait).filter(Boolean).sort();
    assert.deepEqual(named, files);
    for (const name of files) {
        const bytes = readFileSync(new URL(`portraits/${name}`, folder));
        assert.ok(bytes.length <= 150 * 1024, `${name} is ${bytes.length} bytes`);
        assert.equal(bytes.toString('latin1', 0, 4), 'RIFF');
        assert.equal(bytes.toString('latin1', 8, 12), 'WEBP');
        // Lossy WebP: the canvas size is 14 bits each at bytes 26 and 28 of the "VP8 " chunk.
        assert.equal(bytes.toString('latin1', 12, 16), 'VP8 ', name);
        const width = bytes.readUInt16LE(26) & 0x3fff;
        const height = bytes.readUInt16LE(28) & 0x3fff;
        assert.ok(Math.max(width, height) <= 512 && Math.min(width, height) > 0, `${name} is ${width}x${height}`);
    }
});

test('pack.json passes the authoring-kit checker', () => {
    const result = checkPack(packText);
    assert.equal(result.ok, true, report('examples/packs/ersveil-world/pack.json', result));
});

test('Story Block\'s install check accepts it with no errors and no warnings, and refuses it on a suite older than 0.1', () => {
    const good = validatePack(pack(), { capabilities: OPEN });
    assert.equal(good.ok, true, JSON.stringify(good.errors));
    assert.deepEqual(good.errors ?? [], []);
    assert.deepEqual(good.warnings ?? [], []);
    const old = validatePack(pack(), { capabilities: OPEN, suiteVersion: '0.0.9' });
    assert.equal(old.ok, false);
    assert.ok(old.errors.some(error => error.code === 'HOST_VERSION'));
});

test('it is the new Ersveil: 31 people, the world-pack parts, and no legacy events or items', () => {
    const value = pack();
    assert.equal(value.id, 'ersveil');
    assert.equal(value.version, '3.0.0');
    assert.equal(value.requires.suite, '^0.1');
    assert.equal(value.content.cast.length, 31);
    for (const part of ['lore', 'realms', 'powers', 'scores', 'conditions', 'markets', 'worldEvents', 'templates']) assert.ok(value.content[part]?.length ?? Object.keys(value.content[part] ?? {}).length, part);
    assert.equal(value.content.events, undefined);
    assert.equal(value.content.items, undefined);
});

test('the zip is exactly what the build script gives (run `node scripts/core/build-example-zip.mjs` when the pack, README or a portrait changes)', () => {
    assert.ok(Buffer.from(zipBytes()).equals(Buffer.from(buildErsveilWorldZip())), 'examples/packs/ersveil-world.zip is out of date');
});

test('the zip lists pack.json, the twelve portraits, then README.md, and its files are the folder\'s, byte for byte', async () => {
    const names = readZip(zipBytes()).map(entry => entry.name);
    assert.equal(names[0], 'pack.json');
    assert.equal(names.at(-1), 'README.md');
    assert.deepEqual(names.slice(1, -1).sort(), NAMES.map(name => `portraits/${name}.webp`));
    const read = await readPackZip(zipBytes());
    assert.equal(read.ok, true, read.message);
    assert.equal(read.text, packText);
    for (const file of read.files) assert.ok(Buffer.from(await file.read()).equals(readFileSync(new URL(`portraits/${file.name}`, folder))), file.name);
});

test('Story Block installs the zip: twelve portraits saved, 31 people in the cast, nothing refused', async () => {
    const read = await readPackZip(zipBytes());
    const portraitFiles = fakeFiles();
    const made = createPacksPart({ settings: fakeSettings(), portraitFiles });
    const result = await made.packs.install(read.text, { source: 'file', origin: 'ersveil-world.zip', files: read.files });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.portraits.stored.length, 12);
    assert.deepEqual(result.portraits.refused, []);
    assert.equal(portraitFiles.files.size, 12);
    assert.equal(made.packs.list()[0].counts.cast, 31);
});
