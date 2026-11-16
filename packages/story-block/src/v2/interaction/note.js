// The settled note of an interaction: its allowance in tokens, the text the narrator is told and the check that it fits.

import { estimateTokens } from '../prompt-parts/shared-helpers.js';

export const SETTLE_TYPE = 'interaction.settle';
// What a kind's `note` is told it may spend (the fight board's longest note measured at 798 tokens, plus 20 %, rounded up to ten; tests/v2/interaction/note-budget.test.js).
// The note is never cut: a longer one is still sent whole and only raises the quiet NOTE_LONG Problem.
export const INTERACTION_NOTE_TOKENS = 960;

/** The text a settle receipt tells the narrator: its own `summary`, read directly ('' for anything else). */
export const settleCue = receipt => (receipt?.type === SETTLE_TYPE && typeof receipt.summary === 'string' ? receipt.summary : '');

/** The quiet Problem for a note over its allowance, or null. `kind` is the kind def (its `limits.noteTokens` may override), `title` its name. */
export function noteLong(summary, kind, title) {
    const allowance = Number.isInteger(kind?.limits?.noteTokens) && kind.limits.noteTokens > 0 ? kind.limits.noteTokens : INTERACTION_NOTE_TOKENS;
    const size = estimateTokens(summary);
    return size > allowance
        ? { code: 'NOTE_LONG', quiet: true, message: `The ${title ?? 'interaction'} note is ${size} tokens, over its ${allowance}; it is sent whole.` }
        : null;
}
