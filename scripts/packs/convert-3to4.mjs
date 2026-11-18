// Converts a format 3 pack into a format 4 world pack and its companion game pack (pack format 4 §2, §3), with notes for the author.
// The conversion is in convert-3to4-parts/convert.js and the notes in notes.js; this file reads and writes the files.
//
//   node scripts/packs/convert-3to4.mjs <format 3 pack.json> <out dir>   write <out>/world/pack.json, <out>/game/pack.json, <out>/CONVERSION-NOTES.md
//   node scripts/packs/convert-3to4.mjs --ersveil                         rebuild the shipped Ersveil from examples/packs/ersveil-world: examples/packs/ersveil
//                                                                         (pack.json, CONVERSION-NOTES.md, the portraits) and examples/packs/ersveil-game/pack.json
//   node scripts/packs/convert-3to4.mjs --ersveil --check                 exit 1 when those files are not what a rebuild gives
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert3to4 } from './convert-3to4-parts/convert.js';
import { conversionNotes } from './convert-3to4-parts/notes.js';
import { ERSVEIL_PRESET } from './convert-3to4-parts/ersveil.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;

/** The files of a conversion: `{ world, game, notes }` as text, from a format 3 pack's text. */
export function convertText(sourceText, options = {}, sourcePath = 'pack.json') {
    const converted = convert3to4(JSON.parse(sourceText), options);
    return { world: json(converted.world), game: json(converted.game), notes: conversionNotes(converted, sourcePath) };
}

/** The shipped Ersveil, rebuilt: `[{ path (from the repo root), bytes }]` for the world pack, its notes, its portraits and the game pack. */
export function ersveilFiles() {
    const source = ERSVEIL_PRESET.source;
    const text = convertText(readFileSync(path.join(ROOT, source), 'utf8'), ERSVEIL_PRESET, source);
    const world = JSON.parse(text.world);
    const portraits = [...new Set(world.content.cast.map(person => person.portrait).filter(name => typeof name === 'string'))].sort();
    const from = path.join(path.dirname(source), 'portraits');
    return [
        { path: 'examples/packs/ersveil/pack.json', bytes: Buffer.from(text.world) },
        { path: 'examples/packs/ersveil/CONVERSION-NOTES.md', bytes: Buffer.from(text.notes) },
        ...portraits.map(name => ({ path: `examples/packs/ersveil/portraits/${name}`, bytes: readFileSync(path.join(ROOT, from, name)), copy: path.join(ROOT, from, name) })),
        { path: `examples/packs/${ERSVEIL_PRESET.game.id}/pack.json`, bytes: Buffer.from(text.game) },
    ];
}

function runErsveil(check) {
    const files = ersveilFiles();
    let stale = false;
    for (const file of files) {
        const target = path.join(ROOT, file.path);
        if (check) {
            let onDisk = null;
            try { onDisk = readFileSync(target); } catch { /* missing */ }
            if (!onDisk || !onDisk.equals(file.bytes)) { console.error(`${file.path} is not what scripts/packs/convert-3to4.mjs --ersveil builds; run it and commit the result.`); stale = true; }
            continue;
        }
        mkdirSync(path.dirname(target), { recursive: true });
        if (file.copy) copyFileSync(file.copy, target);
        else writeFileSync(target, file.bytes);
    }
    if (!check) {
        const wanted = new Set(files.filter(file => file.copy).map(file => path.basename(file.path)));
        const extra = readdirSync(path.join(ROOT, 'examples/packs/ersveil/portraits')).filter(name => !wanted.has(name));
        if (extra.length) console.error(`examples/packs/ersveil/portraits holds pictures no one names: ${extra.join(', ')}`);
        console.log(`wrote ${files.length} files`);
    } else if (!stale) console.log('Ersveil is up to date');
    if (stale) process.exit(1);
}

function runFile(input, out) {
    const text = convertText(readFileSync(input, 'utf8'), {}, input);
    for (const [file, body] of [['world/pack.json', text.world], ['game/pack.json', text.game], ['CONVERSION-NOTES.md', text.notes]]) {
        mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
        writeFileSync(path.join(out, file), body);
    }
    console.log(`wrote ${out}/world/pack.json, ${out}/game/pack.json and ${out}/CONVERSION-NOTES.md`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const args = process.argv.slice(2);
    if (args.includes('--ersveil')) runErsveil(args.includes('--check'));
    else if (args.length === 2) runFile(args[0], args[1]);
    else { console.error('usage: node scripts/packs/convert-3to4.mjs <format 3 pack.json> <out dir> | --ersveil [--check]'); process.exit(2); }
}
