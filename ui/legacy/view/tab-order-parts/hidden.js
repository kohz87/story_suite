// Hiding tabs: which ids are hidden, the list without them, and hiding or showing one.

import { DEFAULT_HIDDEN, HOME_ID } from '../screens.js';
import { cleanIds, readTabChoice } from './choice.js';
import { orderNav } from './order.js';

/**
 * Is `id` hidden? Home never is; one the reader hid is; one hidden by default (DEFAULT_HIDDEN) is while
 * its partner is there (`present(id)` → true; without `present`, no default applies) and the reader has
 * not shown it again.
 */
export function isHiddenNav(choice, id, present = null) {
    const key = String(id);
    if (key === HOME_ID) return false;
    const clean = readTabChoice(choice);
    if (clean.hidden.includes(key)) return true;
    if (!Object.hasOwn(DEFAULT_HIDDEN, key) || clean.shown.includes(key) || typeof present !== 'function') return false;
    try { return present(DEFAULT_HIDDEN[key]) === true; } catch { return false; }
}

/**
 * orderNav without the hidden ones: what the tab strip and the game view's navigation show. `present`
 * (for DEFAULT_HIDDEN) defaults to "in `list`".
 */
export function visibleNav(list, choice, keyOf = entry => entry.id, orderOf = entry => entry.order, present = null) {
    const keys = new Set([...(list ?? [])].map(keyOf));
    const there = typeof present === 'function' ? present : id => keys.has(id);
    return orderNav(list, choice, keyOf, orderOf).filter(entry => !isHiddenNav(choice, keyOf(entry), there));
}

/**
 * The choice with `id` hidden or shown again. Home cannot be hidden (the choice comes back unchanged). Showing
 * one that is hidden by default (DEFAULT_HIDDEN) keeps it in `shown`, so the default no longer hides it.
 */
export function setNavHidden(choice, id, hidden) {
    const clean = readTabChoice(choice);
    if (typeof id !== 'string' || !id || id === HOME_ID) return clean;
    const rest = clean.hidden.filter(item => item !== id);
    const shown = clean.shown.filter(item => item !== id);
    if (hidden) return { ...clean, hidden: cleanIds([...rest, id]), shown };
    return { ...clean, hidden: rest, shown: Object.hasOwn(DEFAULT_HIDDEN, id) ? cleanIds([...shown, id]) : shown };
}
