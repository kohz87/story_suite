// Navigation order: which screens are in the bar by default, the suite's own screens, and sorting a list by place.

import { HOME_ID, DEFAULT_ORDER, REST_ORDER } from './nav-places.js';

// The screens in the bar by default (the game view's navigation and the Story panel's tabs). A screen or a tab says so itself:
// `bar: true` on its registration puts it in the bar until the reader moves it under More (Settings → Tabs & Packs → Tabs,
// view/tab-order.js). Story Block's own Home and Inventory carry it. A Party or a Fight is in the bar by the last part of its id,
// as DEFAULT_ORDER places them (with the RPG on; Fight is a tab only while a fight is on). Every other screen is under More
// until the reader moves it into the bar.
const BAR_NAMES = Object.freeze(['party', 'fight']);

/**
 * Is `id` in the bar by default (before the reader's choice, tab-order.js isInBar)? `declared` is the screen's or tab's own
 * `bar: true` (the caller reads it from the registration); a Party and a Fight are in the bar without it.
 */
export const inDefaultBar = (id, declared = false) => declared === true
    || BAR_NAMES.includes(String(id ?? '').split('/').pop().toLowerCase());

// The suite's own screens and tabs: always in DEFAULT_ORDER, whatever `order` an older module still gives
// (Cast, now Dossiers, once said 35); the reader moves them in Settings → Tabs & Packs → Tabs.
export const SUITE_NAV = Object.freeze([
    'story-block/inventory', 'story-director/quests', 'story-director/world', 'story-director/map', 'story-block/scene',
    'story-director/chronicle', 'story-director/director', 'npc-state-delta/cast',
]);

/**
 * A screen's (or a tab's) place in the navigation, lower first: 0 for Home; one of the suite's own
 * (SUITE_NAV) its DEFAULT_ORDER place; else its own `order` (at least 1, so nothing goes before Home),
 * else DEFAULT_ORDER by the id's last part, else REST_ORDER.
 */
export function screenOrder(id, order = null) {
    const text = String(id ?? '');
    if (text === HOME_ID) return 0;
    const name = text.split('/').pop().toLowerCase();
    if (SUITE_NAV.includes(text)) return DEFAULT_ORDER[name];
    if (typeof order === 'number' && Number.isFinite(order)) return Math.max(1, order);
    return Object.hasOwn(DEFAULT_ORDER, name) ? DEFAULT_ORDER[name] : REST_ORDER;
}

/** `list` sorted for navigation: by screenOrder, ties kept in the order given. `idOf` / `orderOf` read an entry. */
export function byNavOrder(list, idOf = entry => entry.id, orderOf = entry => entry.order) {
    return list
        .map((entry, at) => ({ entry, at, rank: screenOrder(idOf(entry), orderOf(entry)) }))
        .sort((a, b) => a.rank - b.rank || a.at - b.at)
        .map(item => item.entry);
}
