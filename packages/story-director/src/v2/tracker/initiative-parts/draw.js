// Story Director v2, tracker part (initiative): draws a candidate by weight with a seed and builds the next pick.

import { DEFAULT_COOLDOWN } from './config.js';
import { isRecord } from './shared-guards.js';
import { cooling } from './pick.js';

/** A number in [0, 1) from `text` (FNV-1a, 32 bits): the same text always gives the same number. */
export function hashUnit(text) {
    let hash = 0x811c9dc5;
    for (const char of String(text)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash / 4294967296;
}

/** One of `candidates` (by key order) by weight, with `draw` in [0, 1); null for none. */
export function weightedPick(candidates, draw) {
    const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
    if (!candidates.length || total <= 0) return null;
    let at = Math.floor(Math.max(0, Math.min(0.999999999, draw)) * total);
    for (const entry of candidates) {
        if (at < entry.weight) return entry;
        at -= entry.weight;
    }
    return candidates.at(-1);
}

/** The pick for the next round: `{ round, chosen, eligible, recent }` (`recent`: those still cooling, plus the chosen). */
export function nextPick(candidates, { pick = null, cooldown = DEFAULT_COOLDOWN, draw = 0 } = {}) {
    const round = (pick?.round ?? 0) + 1;
    const cold = cooling(pick, round, cooldown);
    const eligible = candidates.filter(entry => !cold.has(entry.key));
    const chosen = weightedPick(eligible, draw);
    const recent = (Array.isArray(pick?.recent) ? pick.recent : [])
        .filter(entry => isRecord(entry) && cold.has(entry.key) && round - entry.round < cooldown)
        .map(entry => ({ key: entry.key, round: entry.round }));
    if (chosen) recent.push({ key: chosen.key, round });
    return { round, chosen, eligible, recent };
}
