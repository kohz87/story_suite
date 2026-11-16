// The portraits entry of a card: which pack it is for, and its pictures checked one by one (nothing is installed here).

import { sniffImage } from '../portraits.js';
import { CARD_LIMITS } from './limits.js';
import { isObject, parse } from './shared-read.js';

const TYPES = Object.freeze({ webp: 'webp', png: 'png', jpg: 'jpg', jpeg: 'jpg' });
const DATA_URI = /^data:image\/(webp|png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/i;

const bytesOf = b64 => {
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
};

const kb = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The pack id a portraits entry says it is for, or null when the entry is not readable JSON with one. */
export function portraitsPackOf(text) {
    const data = parse(text);
    return isObject(data) && typeof data.pack === 'string' ? data.pack : null;
}

/**
 * The portraits entry's text, checked against the pack it is for (a normalized pack: id, version, content.cast).
 * → `{ ok: true, files: [{ name, size, read() }], lines }` or `{ ok: false, files: [], lines }`; `lines` are Diagnostics lines (skipped
 * pictures on a good entry, the reason on a rejected one). `files` are what installed.js `install` takes as `files`.
 */
export function readPortraitsEntry(text, pack, { limits = CARD_LIMITS } = {}) {
    const lines = [];
    const refuse = message => ({ ok: false, files: [], lines: [`Card portraits for ${pack?.id ?? '?'} were not used: ${message}`] });
    const data = parse(text);
    if (!isObject(data)) return refuse('the entry is not JSON.');
    if (data.v !== 1) return refuse('its "v" is not 1.');
    if (data.pack !== pack.id) return refuse(`they are for the pack "${String(data.pack).slice(0, 60)}", not "${pack.id}".`);
    if (data.version !== pack.version) return refuse(`they are for version ${String(data.version).slice(0, 30)} and the pack is ${pack.version}.`);
    if (!isObject(data.files)) return refuse('"files" is missing.');
    const names = Object.keys(data.files);
    if (names.length > limits.files) return refuse(`there are ${names.length} pictures; at most ${limits.files}.`);
    const named = new Set((pack.content?.cast ?? []).map(person => person.portrait).filter(Boolean));
    const files = [];
    let total = 0;
    for (const name of names) {
        const skip = message => lines.push(`Card portrait ${name.slice(0, 80)} skipped: ${message}`);
        if (!named.has(name)) { skip('no cast member of the pack names that file.'); continue; }
        const given = data.files[name];
        // The size is read from the text's length, before anything is decoded or matched: a huge entry costs nothing to refuse.
        if (typeof given === 'string' && given.length > Math.ceil(limits.fileBytes * 4 / 3) + 64) { skip(`it is about ${kb(Math.floor(given.length * 3 / 4))}; at most ${kb(limits.fileBytes)}.`); continue; }
        const found = typeof given === 'string' ? DATA_URI.exec(given) : null;
        if (!found) { skip('it is not a base64 data: address of a webp, png or jpeg picture.'); continue; }
        // (the encoded length is held to the limit again here, with the data: prefix off)
        const decoded = Math.floor(found[2].length * 3 / 4) - (found[2].match(/=+$/)?.[0].length ?? 0);
        if (decoded > limits.fileBytes) { skip(`it is ${kb(decoded)}; at most ${kb(limits.fileBytes)}.`); continue; }
        let bytes;
        try { bytes = bytesOf(found[2]); } catch { skip('its base64 could not be read.'); continue; }
        if (bytes.length > limits.fileBytes) { skip(`it is ${kb(bytes.length)}; at most ${kb(limits.fileBytes)}.`); continue; }
        const type = sniffImage(bytes);
        if (!type) { skip('its bytes are not a webp, png or jpeg picture.'); continue; }
        if (TYPES[found[1].toLowerCase()] !== type) { skip('its bytes are not the type its address says.'); continue; }
        total += bytes.length;
        if (total > limits.totalBytes) return refuse(`the pictures are more than ${kb(limits.totalBytes)} together.`);
        files.push({ name, size: bytes.length, read: async () => bytes.slice() });
    }
    return { ok: true, files, lines };
}
