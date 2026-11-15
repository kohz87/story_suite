// Name cleaning: a written name tidied for display, its alias index key and a note cut to length. Pure.

import { cutAt } from '../../../text.js';

const ARTICLES = /^(?:a|an|the|some)\s+/i;

/**
 * A written name tidied for display: one line, single spaces, no leading article, in Unicode NFC (so
 * "Rópe" written precomposed or decomposed is one name) and without invisible format characters
 * (zero-width spaces and joiners, bidi marks), which would make two names that look the same.
 */
export function cleanName(name) {
    return String(name ?? '').replace(/\p{Cf}+/gu, '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(ARTICLES, '').trim();
}

/** The alias index key for a name. */
export const aliasKey = name => cleanName(name).toLowerCase();

/** A note or name cut to `max` characters with an ellipsis. */
export function trimText(text, max) {
    const value = String(text ?? '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${cutAt(value, max - 1).trimEnd()}…` : value;
}
