/* Comparing an existing and an incoming text: grounding, similarity, safe refinement and merge. A part of appearance-physical.js (same owner, moved without change). */
import { refinementTokens } from './refine-tokens.js';
import { normalizeName } from '../../core/core-text.js';
import { clean, sameAppearance } from '../appearance-text.js';

export function grounded(value, context = '') {
    const source = String(context || '').trim();
    if (!source) return true;
    const proposed = [...new Set(refinementTokens(value))].filter(token => token.length >= 3 && !/^\d+$/.test(token));
    if (!proposed.length) return false;
    const sourceTokens = new Set(refinementTokens(source));
    const overlap = proposed.filter(token => sourceTokens.has(token));
    return overlap.length >= (proposed.length <= 2 ? 1 : 2);
}
export function similarity(a, b) {
    const left = new Set(refinementTokens(a));
    const right = new Set(refinementTokens(b));
    if (!left.size || !right.size) return normalizeName(a) === normalizeName(b) ? 1 : 0;
    let overlap = 0;
    for (const token of left) if (right.has(token)) overlap += 1;
    const containment = overlap / Math.min(left.size, right.size);
    const jaccard = overlap / (left.size + right.size - overlap);
    return Math.max(jaccard, containment * 0.86, overlap >= 3 && containment >= 0.4 ? 0.62 : 0);
}
export function safeRefinement(existing, incoming) {
    const oldTokens = new Set(refinementTokens(existing));
    const newTokens = new Set(refinementTokens(incoming));
    if (!oldTokens.size || !newTokens.size || normalizeName(existing) === normalizeName(incoming)) return false;
    const addsDetail = [...newTokens].some(token => !oldTokens.has(token));
    const coverage = [...oldTokens].filter(token => newTokens.has(token)).length / oldTokens.size;
    return addsDetail && (coverage >= 0.62 || similarity(existing, incoming) >= 0.58);
}
export function mergeRefinement(existing, incoming, maxChars) {
    const current = clean(existing, maxChars);
    const next = clean(incoming, maxChars);
    if (!current) return next;
    if (!next || sameAppearance(current, next)) return current;
    // The caller has already passed safeRefinement/grounding. `refine` is a full current
    // summary for this exact appearance slot, so omitted old clauses are retired here.
    return next;
}
