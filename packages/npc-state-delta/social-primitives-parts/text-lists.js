/* De-duplicated text lists, slugs and the confidence ranking.
   Part of social-primitives.js; social-primitives.js re-exports it. */

import { clean, norm } from './text-clean.js';

function uniq(values = []) {
    const out = [];
    const seen = new Set();
    for (const value of values) {
        const text = clean(value, 240);
        const key = norm(text);
        if (!text || !key || seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    return out;
}

function slug(value) {
    return norm(value).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'social';
}

function confidenceRank(value) {
    return ({ inferred: 0, migration: 1, 'strong-context': 2, explicit: 3, manual: 4 }[String(value || '').toLowerCase()] ?? 0);
}

export { uniq, slug, confidenceRank };
