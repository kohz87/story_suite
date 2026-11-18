// A search over a state: the JSON Pointers whose key or value holds the query.

import { LIMITS, pointer, isBranch } from './shared.js';

/**
 * A search over a state: every node whose key or plain value holds `query` (any case), as JSON
 * Pointers. `{ matches: Set, ways: Set (every node on the way to a match), keep: Set (both), count,
 * capped }`;
 * at most `limit` matches are kept (`capped` says the search stopped there). An empty query finds nothing.
 */
export function matchPaths(value, query, { limit = LIMITS.matches } = {}) {
    const needle = String(query ?? '').trim().toLowerCase();
    const matches = new Set();
    const ways = new Set();
    const keep = new Set();
    let capped = false;
    if (!needle) return { matches, ways, keep, count: 0, capped };
    const hit = text => String(text).toLowerCase().includes(needle);
    const visit = (node, path, key, trail) => {
        if (capped) return;
        const own = (key !== null && hit(key)) || (!isBranch(node) && node !== undefined && hit(node === null ? 'null' : node));
        if (own) {
            if (matches.size >= limit) {
                capped = true;
                return;
            }
            matches.add(path);
            for (const step of trail) {
                ways.add(step);
                keep.add(step);
            }
            keep.add(path);
        }
        if (isBranch(node)) {
            const next = [...trail, path];
            for (const [k, v] of Object.entries(node)) visit(v, pointer(path, k), k, next);
        }
    };
    visit(value, '', null, []);
    return { matches, ways, keep, count: matches.size, capped };
}
