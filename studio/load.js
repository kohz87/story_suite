// Opens what the author picked: a pack .zip, or a pack.json alone or with its portrait images. No DOM; the shell passes the files.
//
// openPicked(files) → `{ ok: true, name, text, doc, parseError, portraits: [{ name, bytes }], unused: [names] }` or `{ ok: false, message }`.
// A zip goes through packs/bundle.js readPackZip, so the Studio opens exactly what the game's import would read and refuses the
// same zips. `text` is the pack.json as written (the export writes it back unchanged); `doc` is it parsed, or null with
// `parseError` when it is not JSON (the Problems page then shows the checker's NOT_JSON).

import { isZipFile, readPackZip } from '../packs/bundle.js';

const isJson = file => /\.json$/i.test(file?.name ?? '') || file?.type === 'application/json';
const bytesOf = async file => new Uint8Array(await file.arrayBuffer());

function parse(text) {
    try {
        return { doc: JSON.parse(String(text).replace(/^﻿/, '')), parseError: null };
    } catch (error) {
        return { doc: null, parseError: error.message };
    }
}

// The portrait file names the cast asks for, in cast order, each once.
export function portraitNames(doc) {
    const cast = doc?.content?.cast;
    if (!Array.isArray(cast)) return [];
    return [...new Set(cast.map(person => person?.portrait).filter(name => typeof name === 'string' && name))];
}

async function fromZip(file) {
    const read = await readPackZip(await bytesOf(file));
    if (!read.ok) return { ok: false, message: read.message };
    const portraits = [];
    for (const entry of read.files) portraits.push({ name: entry.name, bytes: await entry.read() });
    return { ok: true, name: file.name, text: read.text, ...parse(read.text), portraits, unused: [] };
}

async function fromJson(json, images) {
    const text = await json.text();
    const parsed = parse(text);
    const named = new Set(portraitNames(parsed.doc));
    const portraits = [];
    const unused = [];
    for (const image of images) {
        if (named.has(image.name)) portraits.push({ name: image.name, bytes: await bytesOf(image) });
        else unused.push(image.name);
    }
    return { ok: true, name: json.name, text, ...parsed, portraits, unused };
}

/** Reads the picked files (a FileList or array of File-like objects with name, type, text(), arrayBuffer()). */
export async function openPicked(files) {
    const list = [...(files ?? [])];
    if (!list.length) return { ok: false, message: 'Nothing was picked.' };
    const zips = list.filter(isZipFile);
    if (zips.length) {
        if (list.length > 1) return { ok: false, message: 'Pick the .zip alone, or pick pack.json with its images; not both.' };
        return fromZip(zips[0]);
    }
    const jsons = list.filter(isJson);
    if (jsons.length !== 1) return { ok: false, message: jsons.length ? 'Pick one pack.json at a time.' : 'Pick a pack .zip, or a pack.json (with its portrait images if it has any).' };
    return fromJson(jsons[0], list.filter(file => file !== jsons[0]));
}
