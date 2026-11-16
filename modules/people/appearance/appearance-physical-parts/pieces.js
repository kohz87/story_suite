/* Splitting a segment into trait parts and pure physical pieces. A part of appearance-physical.js (same owner, moved without change). */
import { CHANGEABLE_PRESENTATION } from './trait-patterns.js';
import { physicalTraitKeys } from './segments.js';
import { clean } from '../appearance-text.js';

// "A and B" splits when both halves describe a trait ("Tall and slender", "long silver hair and
// violet eyes"), so one trait can give way without taking the other with it.
export function traitParts(segment) {
    const parts = segment.split(/\s+and\s+/i).map(part => clean(part, 400)).filter(Boolean);
    return parts.length > 1 && parts.every(part => physicalTraitKeys(part).length) ? parts : [segment];
}
// A clause can mix an enduring trait with changeable detail ("long silver hair tied back with a
// ribbon", "her hair is wet"). Split only such mixed clauses at their connectors and keep the pieces
// that describe a trait without any changeable wording, so the trait itself survives and a passing
// changeable mention of it does not count as re-describing it.
export const MIXED_CLAUSE_SPLIT = /\s+(?:with|and|tied|wearing|in|under|beneath|adorned|decorated|covered|while)\s+/i;
export function physicalPieces(segment) {
    const pieces = CHANGEABLE_PRESENTATION.test(segment) ? segment.split(MIXED_CLAUSE_SPLIT) : [segment];
    return pieces.map(piece => clean(piece, 400))
        .filter(piece => piece && physicalTraitKeys(piece).length && !CHANGEABLE_PRESENTATION.test(piece));
}
