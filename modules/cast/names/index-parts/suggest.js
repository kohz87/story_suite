// Story Director v2, names: unused name suggestions from a pack's names lists, picked deterministically.

import { sha256 } from '../../../world/hash.js';
import { DEFAULT_SUGGESTIONS } from './limits.js';
import { flat, cleanName } from './text.js';
import { nameKey } from './keys.js';
import { clampCount } from './clamp-banned.js';
import { checkName } from './check.js';

// The culture whose `regions` name a part of the scene's region ("River Confederacy: Bluewatch" has "River Confederacy").
function cultureFor(names, region) {
    const here = flat(region).toLowerCase();
    if (!here) return null;
    for (const [key, culture] of Object.entries(names)) {
        if (key === 'banned' || !culture || typeof culture !== 'object' || Array.isArray(culture)) continue;
        const regions = Array.isArray(culture.regions) ? culture.regions : [];
        if (regions.some(region => { const want = flat(region).toLowerCase(); return want && here.includes(want); })) return culture;
    }
    return null;
}

/**
 * Up to `count` (0..MAX_SUGGESTIONS) unused names for a new person, from a pack's `names` lists: `names` is
 * `{ banned?: [...], <culture>: { regions: [...], given: [...] } }`, the culture picked by the scene's `region`. A name
 * is dropped when checkName refuses it against `used` (the names in use) and the banned lists. The rest are ranked by
 * sha256 of `seed` and the name's key, so the same seed (a reply's id and the chat's length) gives the same names on every
 * swipe and replay, whatever order the pack lists them in. No pack list, or no matching region: []. Pure.
 */
export function pickSuggestions({ names, region = '', used = [], banned = [], count = DEFAULT_SUGGESTIONS, seed = '' } = {}) {
    if (!names || typeof names !== 'object' || Array.isArray(names)) return [];
    const culture = cultureFor(names, region);
    if (!culture) return [];
    const max = clampCount(count);
    const ban = [...(Array.isArray(names.banned) ? names.banned : []), ...banned];
    const known = used.map(name => ({ name, by: 'used' }));
    const seen = new Set();
    const pool = [];
    for (const raw of Array.isArray(culture.given) ? culture.given : []) {
        const name = cleanName(raw);
        const key = nameKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (checkName(name, { known, banned: ban }).ok) pool.push({ name, rank: sha256(`${flat(seed)}|${key}`) });
    }
    pool.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    return pool.slice(0, max).map(entry => entry.name);
}
