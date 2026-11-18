// The example-zip script and the Studio share one zip writer: the script's bytes equal the Studio's, and the script keeps no writer of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildErsveilZip, buildErsveilWorldZip } from '../../scripts/core/build-example-zip.mjs';
import { writeStoredZip } from '../../studio/zip-write.js';

const at = rel => new URL(`../../${rel}`, import.meta.url);
const bytes = rel => new Uint8Array(readFileSync(at(rel)));
const portraits = (folder, pack) => [...new Set(JSON.parse(new TextDecoder().decode(pack)).content.cast.map(p => p.portrait).filter(n => typeof n === 'string'))]
    .map(name => ({ name: `portraits/${name}`, bytes: bytes(`examples/packs/${folder}/portraits/${name}`) }));

test("the script's Ersveil zip equals the Studio writer's bytes and the zip on disk", () => {
    const pack = bytes('examples/packs/ersveil/pack.json');
    const studio = writeStoredZip([{ name: 'pack.json', bytes: pack }, ...portraits('ersveil', pack)]);
    assert.deepEqual(buildErsveilZip(), studio);
    assert.deepEqual(studio, bytes('examples/packs/ersveil.zip'));
});

test("the script's world zip equals the Studio writer's bytes (README last) and the zip on disk", () => {
    const pack = bytes('examples/packs/ersveil-world/pack.json');
    const studio = writeStoredZip([{ name: 'pack.json', bytes: pack }, ...portraits('ersveil-world', pack), { name: 'README.md', bytes: bytes('examples/packs/ersveil-world/README.md') }]);
    assert.deepEqual(buildErsveilWorldZip(), studio);
    assert.deepEqual(studio, bytes('examples/packs/ersveil-world.zip'));
});

test('the script has no zip writer of its own: it imports the Studio one', () => {
    const source = readFileSync(at('scripts/core/build-example-zip.mjs'), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/studio\/zip-write\.js'/);
    assert.doesNotMatch(source, /0x04034b50|function writeStoredZip/);
});
