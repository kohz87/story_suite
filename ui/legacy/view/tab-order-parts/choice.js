// Reads a saved tab choice into a safe shape (strings only, no repeats, no Home, bounded) and tells when it is the default.

import { DEFAULT_HIDDEN, HOME_ID } from '../screens.js';
import { TAB_ID_MAX, TAB_LIST_MAX } from './constants.js';

export const cleanIds = list => {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const id of list) {
        if (typeof id !== 'string' || !id || id.length > TAB_ID_MAX || id === HOME_ID || out.includes(id)) continue;
        out.push(id);
        if (out.length >= TAB_LIST_MAX) break;
    }
    return out;
};

/**
 * A saved choice made safe: { order, hidden, shown }, strings only, no repeats, no Home, bounded; with `inBar` and `underMore` (the ids the
 * reader put in the bar or under More) only when there are some.
 */
export function readTabChoice(raw) {
    const value = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const order = cleanIds(value.order);
    const hidden = cleanIds(value.hidden);
    // Before `shown`: a default-hidden id the saved order names was in the reader's view, so it stays.
    const shown = Array.isArray(value.shown) ? cleanIds(value.shown)
        : order.filter(id => Object.hasOwn(DEFAULT_HIDDEN, id) && !hidden.includes(id));
    const inBar = cleanIds(value.inBar);
    const underMore = cleanIds(value.underMore).filter(id => !inBar.includes(id));
    return { order, hidden, shown, ...(inBar.length ? { inBar } : {}), ...(underMore.length ? { underMore } : {}) };
}

/** True when the reader has changed nothing (the default order, nothing hidden or shown, nothing moved into or out of the bar). */
export const isDefaultChoice = choice => {
    const clean = readTabChoice(choice);
    return !clean.order.length && !clean.hidden.length && !clean.shown.length && !clean.inBar && !clean.underMore;
};
