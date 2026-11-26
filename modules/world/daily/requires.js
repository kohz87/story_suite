// World events, the daily step: whether an event's requirements and modifiers hold today, and whether a chain cascade kills it
// (spec v0.10 §3 requires / requires_any / likelier_if / less_if). Placeholders (@place, @region, @realm, @route)
// read the binding of a recurring event's or template's pick. Pure (reads `ws`).

import { anchorHolds } from './anchors.js';
import { conditionString, isConditionEntry, partyTerm } from './grammar.js';
import { termHolds } from './near.js';
import { conditionHolds } from './holds-read.js';
import { isThreshold, thresholdHolds } from './threshold.js';

const DAY = 1440;

/** The ref of a condition string with its placeholder bound (`bind` = { place, region, realm, route }), or null when it cannot bind. */
export function boundRef(parsed, bind = {}) {
    if (!parsed.placeholder) return parsed.ref;
    return bind[parsed.placeholder] ?? null;
}

/** One requirement entry (a threshold, a party term, a condition string or an anchor) on `day`; `def` is whose entry it is. */
export function entryHolds(ws, text, day, bind, def) {
    const party = partyTerm(text);
    if (party) return termHolds(ws, party, def, bind);
    if (isThreshold(text)) return thresholdHolds(ws, text);
    if (isConditionEntry(text)) {
        const parsed = conditionString(text);
        const ref = parsed && boundRef(parsed, bind);
        return Boolean(ref) && conditionHolds(ws, parsed.name, ref, day * DAY);
    }
    return anchorHolds(ws, text, day);
}

/** Every `requires` entry and (when written) at least one `requires_any` entry hold. */
export function requiresHold(ws, def, day, bind) {
    const all = def.requires ?? def.needs ?? [];
    if (!all.every(text => entryHolds(ws, text, day, bind, def))) return false;
    const any = def.requiresAny ?? [];
    return !any.length || any.some(text => entryHolds(ws, text, day, bind, def));
}

/** The product of today's matching odds modifiers (likelier_if and less_if); 1 with none. */
export function modifierProduct(ws, def, day, bind) {
    let m = 1;
    for (const { key, m: times } of def.likelier ?? []) if (entryHolds(ws, key, day, bind, def)) m *= times;
    return m;
}
