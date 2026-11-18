// The Studio's open and export: its zip writer gives the same bytes as the example-zip script, a pack zip opened and exported comes
// back byte for byte, pack.json with images keeps only the portraits the cast names, and the same picks the game refuses are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPackZip } from '../../../packs/bundle.js';
import { exportJson, exportZip } from '../../../studio/export.js';
import { openPicked, portraitNames } from '../../../studio/load.js';
import { writeStoredZip } from '../../../studio/zip-write.js';

const at = rel => new URL(`../../../${rel}`, import.meta.url);
const bytes = rel => new Uint8Array(readFileSync(at(rel)));
const fileOf = (name, data, type = '') => new File([data], name, { type });
const ZIP = bytes('examples/packs/ersveil.zip');
const PACK = bytes('examples/packs/ersveil/pack.json');
const WORLD = bytes('tests/packs/studio/fixtures/world-mini.json');

test('the Studio writer builds examples/packs/ersveil.zip byte for byte from its folder', () => {
    const names = portraitNames(JSON.parse(new TextDecoder().decode(PACK)));
    assert.equal(names.length, 12);
    const built = writeStoredZip([{ name: 'pack.json', bytes: PACK }, ...names.map(name => ({ name: `portraits/${name}`, bytes: bytes(`examples/packs/ersveil/portraits/${name}`) }))]);
    assert.deepEqual(built, ZIP);
});

test('a pack zip opened and exported again is the same zip, and the game reads it back', async () => {
    const opened = await openPicked([fileOf('ersveil.zip', ZIP, 'application/zip')]);
    assert.equal(opened.ok, true);
    assert.equal(opened.doc.id, 'ersveil');
    assert.equal(opened.portraits.length, 12);
    const out = exportZip(opened);
    assert.equal(out.name, 'ersveil-3.0.0.zip');
    assert.deepEqual(out.missing, []);
    assert.deepEqual(out.bytes, ZIP);
    const back = await readPackZip(out.bytes);
    assert.equal(back.ok, true);
    assert.equal(back.text, new TextDecoder().decode(PACK));
});

test('pack.json alone exports as the same text', async () => {
    const opened = await openPicked([fileOf('pack.json', WORLD, 'application/json')]);
    assert.equal(opened.ok, true);
    assert.deepEqual(exportJson(opened).bytes, WORLD);
    const zip = exportZip(opened);
    assert.equal(zip.name, 'studio-world-mini-0.1.0.zip');
    assert.deepEqual(zip.missing, ['wren.webp']);
    const back = await readPackZip(zip.bytes);
    assert.deepEqual([back.ok, back.files.length], [true, 0]);
});

test('pack.json with images keeps the portraits the cast names, in the zip under portraits/, and lists the rest as not used', async () => {
    const image = bytes('examples/packs/ersveil/portraits/' + portraitNames(JSON.parse(new TextDecoder().decode(PACK)))[0]);
    const opened = await openPicked([fileOf('pack.json', WORLD, 'application/json'), fileOf('wren.webp', image, 'image/webp'), fileOf('stray.png', image, 'image/png')]);
    assert.deepEqual(opened.portraits.map(file => file.name), ['wren.webp']);
    assert.deepEqual(opened.unused, ['stray.png']);
    const back = await readPackZip(exportZip(opened).bytes);
    assert.deepEqual(back.files.map(file => file.name), ['wren.webp']);
    assert.deepEqual(await back.files[0].read(), image);
});

test('the text is read as UTF-8 the way the game reads it: a leading BOM is not kept in the export, the rest is the same bytes', async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...WORLD]);
    const opened = await openPicked([fileOf('pack.json', withBom, 'application/json')]);
    assert.equal(opened.doc.id, 'studio-world-mini');
    assert.deepEqual(exportJson(opened).bytes, WORLD);
    const back = await readPackZip(exportZip(opened).bytes);
    assert.equal(back.text, new TextDecoder().decode(WORLD));
});

test('text that is not JSON opens (so the checker can say why) with no document', async () => {
    const opened = await openPicked([fileOf('pack.json', '{ nope', 'application/json')]);
    assert.equal(opened.ok, true);
    assert.equal(opened.doc, null);
    assert.match(opened.parseError, /JSON|token|property/i);
});

test('the picks the game refuses are refused in words', async () => {
    assert.equal((await openPicked([])).ok, false);
    assert.match((await openPicked([fileOf('a.zip', ZIP), fileOf('pack.json', WORLD)])).message, /alone/);
    assert.match((await openPicked([fileOf('a.json', WORLD), fileOf('b.json', WORLD)])).message, /one pack\.json/);
    assert.match((await openPicked([fileOf('x.png', new Uint8Array(4))])).message, /Pick a pack/);
    // As the game's import reads a zip: a stray file is refused whole; notes at the top level (.md, .txt) are left out, not refused.
    const stray = writeStoredZip([{ name: 'pack.json', bytes: WORLD }, { name: 'notes.bin', bytes: new Uint8Array(3) }]);
    const refused = await openPicked([fileOf('w.zip', stray)]);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /notes\.bin/);
    const nested = writeStoredZip([{ name: 'pack.json', bytes: WORLD }, { name: 'docs/notes.txt', bytes: new Uint8Array(3) }]);
    assert.match((await openPicked([fileOf('n.zip', nested)])).message, /docs\/notes\.txt/);
    const notes = writeStoredZip([{ name: 'pack.json', bytes: WORLD }, { name: 'notes.txt', bytes: new Uint8Array(3) }, { name: 'README.md', bytes: new Uint8Array(3) }]);
    const kept = await openPicked([fileOf('k.zip', notes)]);
    assert.equal(kept.ok, true);
    assert.deepEqual(kept.portraits, []);
});
