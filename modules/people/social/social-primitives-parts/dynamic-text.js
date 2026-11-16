/* Cleaning a bond dynamic and merging two dynamics into the richer one.
   Part of social-primitives.js; social-primitives.js re-exports it. */

import { cleanBoundary, norm, normalizedWhitespace } from './text-clean.js';
import { SOCIAL_DYNAMIC_MAX_CHARS } from './text-limits.js';
import { nearDuplicateText } from './text-similarity.js';

function cleanDynamic(value, max = SOCIAL_DYNAMIC_MAX_CHARS) {
    const raw = normalizedWhitespace(value);
    if (!raw) return '';
    const kept = [];
    const parts = raw.split(/\s*(?:;|\|)\s*|\s+\/\s+/)
        .map(item => cleanBoundary(item, max))
        .filter(Boolean);
    for (const part of parts) {
        const key = norm(part);
        if (!key || (key.length < 4 && !/\d/.test(key))) continue;
        const duplicateIndex = kept.findIndex(existing => nearDuplicateText(existing, part));
        if (duplicateIndex >= 0) continue;
        kept.push(part);
    }
    let out = '';
    for (const part of kept) {
        const candidate = out ? `${out}; ${part}` : part;
        if (candidate.length <= max) {
            out = candidate;
            continue;
        }
        if (!out) out = cleanBoundary(part, max);
        break;
    }
    return out.replace(/[|/;,\s]+$/g, '').trim();
}

function richer(a, b, max = SOCIAL_DYNAMIC_MAX_CHARS) {
    const left = cleanDynamic(a, max);
    const right = cleanDynamic(b, max);
    if (!left) return right;
    if (!right) return left;
    const ln = norm(left);
    const rn = norm(right);
    if (ln === rn) return right.length >= left.length ? right : left;
    if (ln.includes(rn)) return left;
    if (rn.includes(ln)) return right;
    if (nearDuplicateText(left, right)) return right.length >= left.length ? right : left;
    return cleanDynamic(right.length >= left.length ? `${right}; ${left}` : `${left}; ${right}`, max);
}

export { cleanDynamic, richer };
