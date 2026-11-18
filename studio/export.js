// What Export gives: the pack as a zip (pack.json, then game.json when a game pack is open beside the world, then portraits/<file> for
// each portrait the cast names, in cast order) or pack.json alone, and the file names. Pure; the shell turns the bytes into a download.
//
// pack.json is the pack's present text: the author's text as opened until the first edit, read as UTF-8 the way the game reads it (a
// leading BOM is not kept), so an unedited pack.json saved as plain UTF-8, and a zip the Studio or the example-zip script wrote, come back
// byte for byte; after an edit, the document as 2-space JSON (studio/model/doc.js). exportBlock says why Export is off: a pack with
// errors is not exported (warnings do not stop it).

import { portraitNames } from './load.js';
import { writeStoredZip } from './zip-write.js';

const SAFE = /[^a-z0-9.-]+/gi;
const baseName = doc => [doc?.id, doc?.version].filter(part => typeof part === 'string' && part).join('-').replace(SAFE, '-') || 'pack';

/**
 * The world's zip, with `game` (the open game pack, `{ text }`, or null) as game.json:
 * `{ name, bytes, missing: [portrait names the cast asks for but the Studio does not hold] }`.
 */
export function exportZip({ text, doc, portraits = [] }, game = null) {
    const held = new Map(portraits.map(file => [file.name, file.bytes]));
    const names = portraitNames(doc);
    const files = [{ name: 'pack.json', bytes: new TextEncoder().encode(text) }];
    if (game) files.push({ name: 'game.json', bytes: new TextEncoder().encode(game.text) });
    for (const name of names) if (held.has(name)) files.push({ name: `portraits/${name}`, bytes: held.get(name) });
    return { name: `${baseName(doc)}.zip`, bytes: writeStoredZip(files), missing: names.filter(name => !held.has(name)) };
}

/** One pack's pack.json alone (the world's, or the game's): `{ name, bytes }`. */
export function exportJson({ text }) {
    return { name: 'pack.json', bytes: new TextEncoder().encode(text) };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Why Export is off, or null when it may go: `pack` (the one exported) and `game` (the game pack the world's zip would carry, or null),
 * each `{ check: { errors } }`. → `{ count, text }`: how many errors stop it and the sentence the Studio shows.
 */
export function exportBlock(pack, game = null) {
    const own = pack?.check?.errors?.length ?? 0;
    const carried = game?.check?.errors?.length ?? 0;
    if (!own && !carried) return null;
    const parts = [own ? `the ${plural(own, 'problem')}` : null, carried ? `the game pack’s ${plural(carried, 'problem')}` : null].filter(Boolean);
    return { count: own + carried, text: `Export is off until ${parts.join(' and ')} ${own + carried === 1 ? 'is' : 'are'} fixed. Warnings don’t stop it.` };
}
