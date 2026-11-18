// Converts a format 3 pack into a format 4 world pack and its companion game pack (pack format 4 §2, §3), with notes for the author.
// The conversion is in convert-3to4-parts/convert.js and the notes in notes.js; this file reads and writes the files.
//
//   node scripts/packs/convert-3to4.mjs <format 3 pack.json> <out dir>   write <out>/world/pack.json, <out>/game/pack.json, <out>/CONVERSION-NOTES.md
//
// The shipped Ersveil (examples/packs/ersveil and ersveil-game) was made by this converter from the format 3 sample, which is gone (format 3 is obsolete): the pair
// is edited directly now.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert3to4 } from './convert-3to4-parts/convert.js';
import { conversionNotes } from './convert-3to4-parts/notes.js';

const json = value => `${JSON.stringify(value, null, 2)}\n`;

/** The files of a conversion: `{ world, game, notes }` as text, from a format 3 pack's text. */
export function convertText(sourceText, options = {}, sourcePath = 'pack.json') {
    const converted = convert3to4(JSON.parse(sourceText), options);
    return { world: json(converted.world), game: json(converted.game), notes: conversionNotes(converted, sourcePath) };
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
    if (args.length === 2) runFile(args[0], args[1]);
    else { console.error('usage: node scripts/packs/convert-3to4.mjs <format 3 pack.json> <out dir>'); process.exit(2); }
}
