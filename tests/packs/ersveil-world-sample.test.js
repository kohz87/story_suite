// The sample world source (examples/packs/ersveil-world, Ersveil 3.0.0, the new world): the twelve portraits are web size, and examples/packs/ersveil-world.zip is exactly what
// scripts/core/build-example-zip.mjs builds and reads back through the zip reader. It is the source scripts/packs/convert-3to4.mjs turns into the format 4 Ersveil
// (examples/packs/ersveil and ersveil-game, checked by ersveil-pack, ersveil-cast and ersveil-zip); this suite no longer reads it as a pack, only as files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readPackZip } from '../../packs/bundle.js';
import { readZip } from '../../packs/zip.js';
import { buildErsveilWorldZip } from '../../scripts/core/build-example-zip.mjs';

const packs = new URL('../../examples/packs/', import.meta.url);
const folder = new URL('ersveil-world/', packs);
const packText = readFileSync(new URL('pack.json', folder), 'utf8');
const pack = () => JSON.parse(packText);
const zipBytes = () => new Uint8Array(readFileSync(new URL('ersveil-world.zip', packs)));
const NAMES = ['asphodel', 'barney', 'gorm', 'harrak', 'hush', 'lothar', 'nerissa', 'nysseth', 'rika', 'temiwa', 'torka', 'ysmeth'];

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
