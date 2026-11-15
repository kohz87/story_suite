/* Reading the enduring-trait pieces of a look and the words of one trait. A part of appearance-physical.js (same owner, moved without change). */
import { CONCEALED_MENTION } from './trait-patterns.js';
import { addressedTraitKeys, physicalTraitKeys, presentationSegments } from './segments.js';
import { physicalPieces, traitParts } from './pieces.js';
import { TRAIT_AXES } from './swap-axes.js';
import { clean } from '../appearance-text.js';

const traitWords = text => String(text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
// A piece that speaks of a wrap, sash or other garment on a body part ("tail in a grey linen wrap") is clothing, not the part's colour.
const OUTFIT_WORDS = /\b(?:wrap|wrapped|wrapping|linen|sash|veil|bandages?|bandaged|binding|bound|ribbons?|silk|cloth|leather|lace|gauze|fabric|collar|band)\b/i;
// "Brown eyes with a pale ring" is one claim, but "Long black hair with violet eyes" holds two: split at "with" only when both halves name a trait.
function withParts(text) {
    const parts = text.split(/\s+with\s+/i).map(part => clean(part, 400)).filter(Boolean);
    return parts.length > 1 && parts.every(part => physicalTraitKeys(part).length) ? parts : [text];
}
// The trait pieces of a look: { text, keys } for every piece that describes an enduring trait (not clothing, not a hidden mention).
export function traitPieces(value) {
    return presentationSegments(value)
        .filter(segment => !CONCEALED_MENTION.test(segment))
        .flatMap(physicalPieces)
        .flatMap(traitParts)
        .flatMap(withParts)
        .filter(text => !OUTFIT_WORDS.test(text))
        .map(text => ({ text, keys: addressedTraitKeys(text).filter(key => TRAIT_AXES[key]) }))
        .filter(piece => piece.keys.length);
}
export const valueWords = (pieces, key) => pieces.filter(piece => piece.keys.includes(key)).flatMap(piece => traitWords(piece.text));
