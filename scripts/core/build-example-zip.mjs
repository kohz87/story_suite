// Builds examples/packs/ersveil.zip from examples/packs/ersveil/ and examples/packs/ersveil-world.zip from examples/packs/ersveil-world/ (the sample world pack, with its README.md): pack.json first, then portraits/<file> for each picture the cast
// names, in cast order. This is the layout Story Studio exports and Story Block's zip import reads (src/v2/packs/bundle.js).
// Deterministic: the zip is written by studio/zip-write.js (the one writer, shared with the Studio): every file is stored (no compression, so no dependence on the zlib version), names are UTF-8, there are no folder
// entries or extra fields, and the time stamp is fixed (1980-01-01), so rebuilding always gives the same bytes.
//
//   node scripts/core/build-example-zip.mjs           write both zips
//   node scripts/core/build-example-zip.mjs --check   exit 1 if a zip on disk is not what a rebuild gives
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeStoredZip } from '../../studio/zip-write.js';

const root = new URL('../../examples/packs/', import.meta.url);

/** The zip of examples/packs/<folder>/: pack.json, then portraits/<file> for each picture the cast names, then README.md when there is one. */
function buildFolderZip(folderName, withReadme) {
    const folder = new URL(`${folderName}/`, root);
    const packBytes = new Uint8Array(readFileSync(new URL('pack.json', folder)));
    const cast = JSON.parse(new TextDecoder().decode(packBytes)).content.cast;
    const names = [...new Set(cast.map(person => person.portrait).filter(name => typeof name === 'string'))];
    const files = [
        { name: 'pack.json', bytes: packBytes },
        ...names.map(name => ({ name: `portraits/${name}`, bytes: new Uint8Array(readFileSync(new URL(`portraits/${name}`, folder))) })),
    ];
    if (withReadme) files.push({ name: 'README.md', bytes: new Uint8Array(readFileSync(new URL('README.md', folder))) });
    return writeStoredZip(files);
}

/** The Ersveil zip, built from examples/packs/ersveil/pack.json and the portraits its cast names. */
export function buildErsveilZip() { return buildFolderZip('ersveil', false); }

/** The sample world pack zip (examples/packs/ersveil-world.zip): the same layout plus the pack's README.md. */
export function buildErsveilWorldZip() { return buildFolderZip('ersveil-world', true); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const check = process.argv.includes('--check');
    let stale = false;
    for (const [file, bytes] of [['ersveil.zip', buildErsveilZip()], ['ersveil-world.zip', buildErsveilWorldZip()]]) {
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
