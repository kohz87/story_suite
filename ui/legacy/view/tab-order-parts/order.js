// The reader's order of the tabs: each entry's key, the list put in that order, and moving one entry up or down.

import { HOME_ID, byNavOrder } from '../screens.js';
import { TAB_LIST_MAX } from './constants.js';
import { cleanIds, readTabChoice } from './choice.js';

/**
 * The id one entry of the Story panel's tab list goes by: a tab screen's own id, a module tab's
 * "<module>/<id>" (an id that already has a "/" is kept).
 */
export function navKey(tab) {
    const id = String(tab?.id ?? '');
    if (!tab?.moduleId || tab.moduleId === 'screens' || id.includes('/')) return id;
    return `${tab.moduleId}/${id}`;
}

/**
 * `list` in the reader's order: Home first, then the ids the choice names in its order, then the rest in
 * default order (screenOrder). Every entry stays, hidden ones too (see visibleNav).
 */
export function orderNav(list, choice, keyOf = entry => entry.id, orderOf = entry => entry.order) {
    const defaults = byNavOrder([...(list ?? [])], keyOf, orderOf);
    const { order } = readTabChoice(choice);
    if (!order.length) return defaults;
    const place = new Map(order.map((id, at) => [id, at]));
    const home = defaults.filter(entry => keyOf(entry) === HOME_ID);
    const named = defaults.filter(entry => place.has(keyOf(entry)))
        .sort((a, b) => place.get(keyOf(a)) - place.get(keyOf(b)));
    const fresh = defaults.filter(entry => keyOf(entry) !== HOME_ID && !place.has(keyOf(entry)));
    return [...home, ...named, ...fresh];
}

/**
 * The choice after moving `id` by `delta` (-1 up, +1 down) in `current` (the ids as Settings lists them,
 * in the order shown). Home and the edges stay put. Saved ids not in `current` (a module not installed
 * now) keep their slots among the rest, so the module comes back where the reader put it: the ids shown
 * fill the slots the saved order gave the shown ones, in their new order, and the ones never saved follow.
 * Returns the same choice when nothing moves.
 */
export function moveNav(choice, current, id, delta) {
    const clean = readTabChoice(choice);
    const ids = cleanIds(current);
    const at = ids.indexOf(id);
    const to = at + Math.sign(Number(delta) || 0);
    if (at < 0 || to < 0 || to >= ids.length || to === at) return clean;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    const queue = [...ids];
    const order = clean.order.map(item => (ids.includes(item) ? queue.shift() : item));
    return { ...clean, order: [...order, ...queue].slice(0, TAB_LIST_MAX) };
}
