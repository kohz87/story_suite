// Place name normalization and key derivation.

import { MAX_NAME } from './shape.js';

// Invisible format marks (zero-width spaces and joiners, bidi overrides): "Ro\u200Bpe" and "\u202ERope"
// are "Rope", as Story Block reads its own names (names.js).
const INVISIBLE = /\p{Cf}+/gu;

/** The key a name is found by: v1's place book key (apostrophes dropped, spaces folded, lowercase). */
export const keyOf = name => String(name ?? '').replace(INVISIBLE, '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** A name as it is kept: invisible marks and markdown marks dropped, NFC, spaces folded, at most 80 characters. */
export function cleanName(name) {
    return String(name ?? '').replace(INVISIBLE, '').normalize('NFC').replace(/\*\*|__|[*`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

/** A kind, region or layer word as it is kept: lowercase for kinds, as written for the rest. */
export const cleanWord = (value, { lower = false } = {}) => {
    const text = cleanName(value);
    return lower ? text.toLowerCase() : text;
};
