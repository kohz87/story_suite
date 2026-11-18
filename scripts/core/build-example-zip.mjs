// Builds examples/packs/ersveil.zip from examples/packs/ersveil/ (the format 4 world pack, with its companion game pack examples/packs/ersveil-game/pack.json as
// game.json and its CONVERSION-NOTES.md) and examples/packs/ersveil-world.zip from examples/packs/ersveil-world/ (the format 3 sample world pack, with its README.md):
// pack.json first, then portraits/<file> for each picture the cast names, in cast order, then the extra files. This is the layout Story Studio exports and Story Block's zip import reads (src/v2/packs/bundle.js).
// Deterministic: every file is stored (no compression, so no dependence on the zlib version), names are UTF-8, there are no folder
// entries or extra fields, and the time stamp is fixed (1980-01-01), so rebuilding always gives the same bytes.
//
//   node scripts/core/build-example-zip.mjs           write both zips
//   node scripts/core/build-example-zip.mjs --check   exit 1 if a zip on disk is not what a rebuild gives
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32 } from '../../packs/zip.js';

const root = new URL('../../examples/packs/', import.meta.url);
const DOS_DATE = (1 << 5) | 1; // 1980-01-01, time 00:00:00
const UTF8 = 0x0800;

/** `files`: `[{ name, bytes }]` -> the zip as a Uint8Array (stored, fixed time stamp, listed in the order given). */
export function writeStoredZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const { name, bytes } of files) {
        const label = encoder.encode(name);
        const crc = crc32(bytes);
        const head = new DataView(new ArrayBuffer(30));
        head.setUint32(0, 0x04034b50, true);
        head.setUint16(4, 10, true);
        head.setUint16(6, UTF8, true);
        head.setUint16(12, DOS_DATE, true);
        head.setUint32(14, crc, true);
        head.setUint32(18, bytes.length, true);
        head.setUint32(22, bytes.length, true);
        head.setUint16(26, label.length, true);
        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true);
        entry.setUint16(6, 10, true);
        entry.setUint16(8, UTF8, true);
        entry.setUint16(14, DOS_DATE, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, bytes.length, true);
        entry.setUint32(24, bytes.length, true);
        entry.setUint16(28, label.length, true);
        entry.setUint32(42, offset, true);
        central.push(new Uint8Array(entry.buffer), label);
        parts.push(new Uint8Array(head.buffer), label, bytes);
        offset += 30 + label.length + bytes.length;
    }
    const size = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of all) { out.set(part, at); at += part.length; }
    return out;
}

/** The zip of examples/packs/<folder>/: pack.json, then portraits/<file> for each picture the cast names, then `extra` (`[[name in the zip, path from examples/packs/]]`). */
function buildFolderZip(folderName, extra) {
    const folder = new URL(`${folderName}/`, root);
    const packBytes = new Uint8Array(readFileSync(new URL('pack.json', folder)));
    const cast = JSON.parse(new TextDecoder().decode(packBytes)).content.cast;
    const names = [...new Set(cast.map(person => person.portrait).filter(name => typeof name === 'string'))];
    const files = [
        { name: 'pack.json', bytes: packBytes },
        ...names.map(name => ({ name: `portraits/${name}`, bytes: new Uint8Array(readFileSync(new URL(`portraits/${name}`, folder))) })),
    ];
    for (const [name, from] of extra) files.push({ name, bytes: new Uint8Array(readFileSync(new URL(from, root))) });
    return writeStoredZip(files);
}

/** The Ersveil zip: the world pack examples/packs/ersveil/pack.json, the portraits its cast names, the game pack as game.json and the conversion notes. */
export function buildErsveilZip() { return buildFolderZip('ersveil', [['game.json', 'ersveil-game/pack.json'], ['CONVERSION-NOTES.md', 'ersveil/CONVERSION-NOTES.md']]); }

/** The sample world pack zip (examples/packs/ersveil-world.zip): the same layout plus the pack's README.md. */
export function buildErsveilWorldZip() { return buildFolderZip('ersveil-world', [['README.md', 'ersveil-world/README.md']]); }

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
