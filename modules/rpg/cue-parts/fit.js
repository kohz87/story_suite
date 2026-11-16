// Fits the cue to the budget by shortening it.

import { LIMITS } from '../names.js';
import { cueTokens } from './words.js';
import { cueText } from './text.js';

/**
 * The cue that fits the budget, by shortening (SPEC_RPG_v1 §4.5.3): all of `parts.rounds`, then fewer (never fewer than one);
 * if one round is still too long, the checks and refusals in fewer words, then the refusals as a count, then the names cut.
 * → { count, shape, text } (`count` rounds told; the last shape is used even when nothing fits, which only a plan of
 * unusually long names could come to, and those are cut there). `earlier`: the rule of a roll made before the shortening existed (a
 * payload with no `dice` version): only fewer rounds, never fewer than one, as written; so a Re-read of it tells what it told.
 */
export function fitCue(parts, budget = LIMITS.cueTokens, { earlier = false } = {}) {
    const total = parts.rounds.length;
    let last = null;
    for (let shape = 0; shape <= (earlier ? 0 : 3); shape += 1) {
        for (let count = total; count >= Math.min(1, total); count -= 1) {
            const told = { ...parts, rounds: parts.rounds.slice(0, count), decisive: parts.decisive && count === total, end: count === total ? parts.end ?? null : null };
            // Gear's wear lines (gear.js `wearOf`) count in the budget.
            if (typeof parts.wearOf === 'function') told.wear = parts.wearOf(told.rounds, parts.standard?.opening ?? []);
            last = { count, shape, text: cueText(told, shape) };
            // Measured as if no stat were hidden, so whether a stat is hidden never changes how many rounds are told (review
            // 164); the text that is sent is never longer than the one measured.
            if (cueTokens(cueText(told, shape, { plain: true })) <= budget) return last;
        }
    }
    return last;
}
