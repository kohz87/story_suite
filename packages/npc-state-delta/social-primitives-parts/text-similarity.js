/* Word-overlap and near-duplicate tests between two social texts.
   Part of social-primitives.js; social-primitives.js re-exports it. */

import { norm } from './text-clean.js';

const SOCIAL_SEMANTIC_STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'her', 'his', 'their', 'they', 'them',
    'she', 'him', 'who', 'whom', 'at', 'in', 'on', 'to', 'of', 'as', 'is', 'was', 'are', 'were', 'been',
]);

function semanticWords(value) {
    return new Set(norm(value).split(/\s+/)
        .filter(token => token.length > 2 && !SOCIAL_SEMANTIC_STOPWORDS.has(token)));
}

function semanticOverlap(a, b) {
    const left = semanticWords(a);
    const right = semanticWords(b);
    if (!left.size || !right.size) return 0;
    let shared = 0;
    for (const token of left) if (right.has(token)) shared += 1;
    return shared / Math.min(left.size, right.size);
}

function nearDuplicateText(a, b) {
    const left = norm(a);
    const right = norm(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left) || semanticOverlap(left, right) >= 0.72;
}

export { SOCIAL_SEMANTIC_STOPWORDS, semanticWords, semanticOverlap, nearDuplicateText };
