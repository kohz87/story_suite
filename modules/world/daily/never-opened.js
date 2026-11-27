// World events, the daily step: whether an event's branch never opened, so that its lapse is not news to the reader. Pure (reads `ws`).

import { anchorHolds } from './anchors.js';
import { anchorString, isConditionEntry, partyTerm } from './grammar.js';
import { isThreshold } from './threshold.js';

// Anchors that stay true once they happened (the step keeps their days): one that does not hold now never held before.
const LASTING = new Set(['fact', 'stage', 'fired', 'ended']);

function neverHeld(ws, text, day) {
    if (isThreshold(text) || partyTerm(text) || isConditionEntry(text)) return false;
    const anchor = anchorString(text);
    // The anchor without its offset: a branch that opened, its "+ 90 days" not yet passed, did open.
    return Boolean(anchor) && LASTING.has(anchor.kind) && !anchorHolds(ws, { ...anchor, offset: 0 }, day);
}

/**
 * True only when it is certain the requirements never held by `day`: a `requires` entry never happened, or no `requires_any` entry
 * ever did. A condition, threshold, party term or season can hold and stop holding, and nothing records that, so those count as maybe.
 */
export function neverOpened(ws, def, day) {
    if ((def.requires ?? []).some(text => neverHeld(ws, text, day))) return true;
    const any = def.requiresAny ?? [];
    return any.length > 0 && any.every(text => neverHeld(ws, text, day));
}
