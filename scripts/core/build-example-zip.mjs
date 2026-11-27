// Builds examples/packs/ersveil.zip from examples/packs/ersveil/ (the format 4 world pack, with its companion game pack examples/packs/ersveil-game/pack.json as
// game.json and its CONVERSION-NOTES.md):
// pack.json first, then portraits/<file> for each picture the cast names, in cast order, then the extra files. This is the layout Story Studio exports and Story Block's zip import reads (src/v2/packs/bundle.js).
// Arsveil's pack.json and game.json go into its zip minified (the source file is pretty-printed for diffs; minified, the zip stays small); every other file goes in byte for byte.
// Deterministic: the zip is written by studio/zip-write.js (the one writer, shared with the Studio): every file is stored (no compression, so no dependence on the zlib version), names are UTF-8, there are no folder
// entries or extra fields, and the time stamp is fixed (1980-01-01), so rebuilding always gives the same bytes.
//
//   node scripts/core/build-example-zip.mjs           write the zip
//   node scripts/core/build-example-zip.mjs --check   exit 1 if a zip on disk is not what a rebuild gives
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeStoredZip } from '../../studio/zip-write.js';

const root = new URL('../../examples/packs/', import.meta.url);

const asWritten = bytes => bytes;
const minified = bytes => new TextEncoder().encode(JSON.stringify(JSON.parse(new TextDecoder().decode(bytes))));

/**
 * The zip of examples/packs/<folder>/: pack.json, then portraits/<file> for each picture the cast names, then `extra` (`[[name in the zip, path from examples/packs/]]`).
 * `json`: what happens to pack.json and game.json on the way in.
 */
function buildFolderZip(folderName, extra, json = asWritten) {
    const folder = new URL(`${folderName}/`, root);
    const packBytes = new Uint8Array(readFileSync(new URL('pack.json', folder)));
    const cast = JSON.parse(new TextDecoder().decode(packBytes)).content.cast;
    const names = [...new Set(cast.map(person => person.portrait).filter(name => typeof name === 'string'))];
    const files = [
        { name: 'pack.json', bytes: json(packBytes) },
        ...names.map(name => ({ name: `portraits/${name}`, bytes: new Uint8Array(readFileSync(new URL(`portraits/${name}`, folder))) })),
    ];
    for (const [name, from] of extra) {
        const bytes = new Uint8Array(readFileSync(new URL(from, root)));
        files.push({ name, bytes: name === 'game.json' ? json(bytes) : bytes });
    }
    return writeStoredZip(files);
}

/** The Ersveil zip: the world pack examples/packs/ersveil/pack.json, the portraits its cast names, the game pack as game.json and the conversion notes. */
export function buildErsveilZip() { return buildFolderZip('ersveil', [['game.json', 'ersveil-game/pack.json'], ['CONVERSION-NOTES.md', 'ersveil/CONVERSION-NOTES.md']]); }

/** The Arsveil zip: Ersveil's world with its own cast (examples/packs/arsveil/pack.json), the portraits its cast names and the same game pack as game.json; both JSON files minified. */
export function buildArsveilZip() { return buildFolderZip('arsveil', [['game.json', 'ersveil-game/pack.json']], minified); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const check = process.argv.includes('--check');
    let stale = false;
    for (const [file, bytes] of [['ersveil.zip', buildErsveilZip()], ['arsveil.zip', buildArsveilZip()]]) {
        const target = new URL(file, root);
        if (check) {
            let onDisk = null;
            try { onDisk = readFileSync(target); } catch { /* missing */ }
            if (!onDisk || Buffer.compare(Buffer.from(bytes), onDisk) !== 0) { console.error(`examples/packs/${file} is not what scripts/core/build-example-zip.mjs builds; run it and commit the result.`); stale = true; }
            else console.log(`${file} is up to date`);
        } else {
            writeFileSync(target, bytes);
            console.log(`wrote examples/packs/${file} (${bytes.length} bytes)`);
        }
    }
    if (stale) process.exit(1);
}
