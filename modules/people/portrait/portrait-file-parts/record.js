// The file-form portrait record: telling one from other portraits, making one from bytes and the has-image test.
import { sha256Hex } from './hash.js';
import { PORTRAIT_FILE_DIR, isObject, portraitFileName } from './shared-name.js';

/** Whether `portrait` is a file-form record whose path is the one its own hash and type give (a path from a bundle or a hand edit is never trusted). */
export function isPortraitFileRecord(portrait) {
    if (!isObject(portrait) || typeof portrait.path !== 'string') return false;
    const name = portraitFileName(portrait.hash, portrait.type);
    return Boolean(name) && portrait.path === `${PORTRAIT_FILE_DIR}${name}`;
}

/** Whether the record holds an image of its own (data or a file, even one that is gone: it is still the person's portrait). */
export const portraitHasImage = portrait => isObject(portrait) && (Boolean(portrait.dataUrl) || isPortraitFileRecord(portrait));

/** The record a picture's bytes make: { path, type, hash }, or null for a type that is not stored. */
export function portraitFileRecordFor(bytes, type) {
    const hash = sha256Hex(bytes);
    const name = portraitFileName(hash, type);
    return name ? { path: `${PORTRAIT_FILE_DIR}${name}`, type: String(type).toLowerCase(), hash } : null;
}
