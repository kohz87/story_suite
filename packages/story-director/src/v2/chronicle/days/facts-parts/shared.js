// Story Director v2, chronicle part: shared name, uniqueness, and happened-line selection helpers for day facts.

import { ENTRY_HAPPENED, MAX_NAME, cut, flat } from '../shared.js';

export const keyOf = name => flat(name).normalize('NFKC').toLowerCase();

export function pushUnique(list, value, max, seen) {
    const item = cut(value, MAX_NAME);
    const key = keyOf(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (list.length < max) list.push(item);
}

export const itemOf = ({ text: said, told, type, thread, who }) => ({ text: said, told, ...(type ? { type } : {}), ...(thread ? { thread } : {}), ...(Array.isArray(who) && who.length ? { who } : {}) });

// At most MAX_HAPPENED, those the story was told first, in the order they came.
export function pickHappened(candidates) {
    return [...candidates].sort((a, b) => Number(b.told) - Number(a.told) || a.at - b.at).slice(0, ENTRY_HAPPENED).sort((a, b) => a.at - b.at);
}
