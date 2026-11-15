/* Dropping presentation pieces already held in the shared physical slot. A part of appearance-physical.js (same owner, moved without change). */
import { refinementTokens } from './refine-tokens.js';
import { CHANGEABLE_PRESENTATION } from './trait-patterns.js';
import { presentationSegments } from './segments.js';
import { normalizeName } from '../core-text.js';
import { appearanceClauses, appearanceText, clean } from '../appearance-text.js';

// A current presentation may restate some of the enduring physical features held in the shared
// slot ("Long silver hair, violet eyes; wearing a gown"). Drop only comma-level pieces that exactly
// match a shared piece, so the resolved appearance does not repeat them; anything that differs,
// including negated or re-described traits, is kept.
// A piece is also redundant when every content word in it already appears in the shared slot and it
// carries no changeable or negated wording ("faintly pointed" beside shared "faintly pointed,
// swept-back ears"). A piece that adds any detail, or negates or changes a trait, is kept.
export const NEGATED_DETAIL = /\b(?:no|not|never|without|none|nor|no longer|lacks?|lacking)\b/i;
export function coveredBySharedTokens(piece, sharedTokens) {
    if (!sharedTokens.size || NEGATED_DETAIL.test(piece) || CHANGEABLE_PRESENTATION.test(piece)) return false;
    const tokens = refinementTokens(piece).filter(token => !/^\d+$/.test(token));
    return tokens.length > 0 && tokens.every(token => sharedTokens.has(token));
}
export function withoutSharedPieces(value, shared) {
    const text = appearanceText(value);
    const sharedPieces = new Set(presentationSegments(shared).map(normalizeName).filter(Boolean));
    if (!text || !sharedPieces.size) return text;
    const sharedTokens = new Set(refinementTokens(shared));
    let changed = false;
    const clauses = appearanceClauses(text).map(clause => {
        const parts = clause.split(/\s*,\s*/);
        const kept = parts.filter(part => {
            const piece = part.replace(/^(?:and|with)\s+/i, '').replace(/[.!?]+$/, '');
            return !sharedPieces.has(normalizeName(piece)) && !coveredBySharedTokens(piece, sharedTokens);
        });
        if (kept.length !== parts.length) changed = true;
        return kept.join(', ');
    }).filter(clause => clean(clause, 800));
    return changed ? appearanceText(clauses.join('; ')) : text;
}
