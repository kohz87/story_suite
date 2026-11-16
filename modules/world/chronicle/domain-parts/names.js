// Chronicle's name keys and the cleaning of names and summaries.

import { MAX_NAME, MAX_SUMMARY } from './limits-text.js';

// Invisible format marks (zero-width spaces and joiners, bidi overrides): "Ro\u200Bpe" and "\u202ERope"
// are "Rope", as Story Block reads its own names (names.js).
const INVISIBLE = /\p{Cf}+/gu;

/** The key a name is found by: invisible marks and apostrophes dropped, spaces folded, lowercase. */
export const keyOf = name => String(name ?? '').replace(INVISIBLE, '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
// The key as it was made before invisible marks were dropped: two entries saved then stay apart.
export const keptKeyOf = name => String(name ?? '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** A name or short word as it is kept: invisible and markdown marks dropped, NFC, spaces folded, at most 80 characters. */
export function cleanName(name) {
    return String(name ?? '').replace(INVISIBLE, '').normalize('NFC').replace(/\*\*|__|[*`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

/** A summary as it is kept: one line, at most 300 characters (cut at a word when it is longer). */
export function cleanSummary(text) {
    const flat = String(text ?? '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
    if (flat.length <= MAX_SUMMARY) return flat;
    const cut = flat.slice(0, MAX_SUMMARY - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > MAX_SUMMARY / 2 ? cut.slice(0, space) : cut).trim()}…`;
}
