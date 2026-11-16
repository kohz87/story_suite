/* Semantic similarity, compact-equivalent choice and semantic deduplication of items. */
import { cleanText, normalizeName } from '../core-text.js';
import { durableRefinementTokens } from './tokens.js';

export function durableSemanticSimilarity(a, b) {
    const left = new Set(durableRefinementTokens(a));
    const right = new Set(durableRefinementTokens(b));
    if (!left.size || !right.size) return normalizeName(a) === normalizeName(b) ? 1 : 0;
    if (Math.min(left.size, right.size) < 2) return normalizeName(a) === normalizeName(b) ? 1 : 0;
    let overlap = 0;
    for (const token of left) if (right.has(token)) overlap += 1;
    const containment = overlap / Math.min(left.size, right.size);
    const jaccard = overlap / (left.size + right.size - overlap);
    const conceptCluster = overlap >= 3 && containment >= 0.4 ? 0.62 : 0;
    return Math.max(jaccard, containment * 0.86, conceptCluster);
}

export function chooseCompactEquivalent(existing, incoming) {
    const oldText = cleanText(existing, 1200);
    const newText = cleanText(incoming, 1200);
    if (!oldText) return newText;
    if (!newText) return oldText;
    const oldCount = new Set(durableRefinementTokens(oldText)).size;
    const newCount = new Set(durableRefinementTokens(newText)).size;
    if (newCount >= oldCount + 2) return newText;
    if (oldCount >= newCount + 2) return oldText;
    return newText.length <= oldText.length * 1.15 ? newText : oldText;
}

export function semanticDedupeItems(items, { maxItems = 8, maxChars = 320, similarity = 0.62 } = {}) {
    const out = [];
    for (const raw of Array.isArray(items) ? items : []) {
        const item = cleanText(raw, maxChars);
        if (!item) continue;
        const exact = normalizeName(item);
        let match = out.findIndex(existing => normalizeName(existing) === exact || durableSemanticSimilarity(existing, item) >= similarity);
        if (match >= 0) out[match] = chooseCompactEquivalent(out[match], item);
        else out.push(item);
        if (out.length > maxItems * 2) out.splice(0, out.length - maxItems * 2);
    }
    return out.slice(-maxItems);
}
