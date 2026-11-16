// Cleans a nav's item list: the first of each id, labels and ids cut, at most a limit.

import { NAV_MAX_ITEMS, LABEL_MAX, ID_MAX } from './shared-limits.js';
import { short } from './shared-short.js';

const COUNT_MAX = 4;

/**
 * The items as drawn: at most `max` (NAV_MAX_ITEMS), each { id, label, icon, count, disabled }, the first of each id;
 * a label is cut at `labelMax` (LABEL_MAX). A host with its own longer list (the story panel's tabs) passes its limits.
 */
export function navItems(list, max = NAV_MAX_ITEMS, labelMax = LABEL_MAX, idMax = ID_MAX) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        const label = short(raw.label, labelMax);
        const id = short(raw.id, idMax) || label;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, label: label || id, icon: typeof raw.icon === 'string' ? raw.icon : '', count: short(raw.count, COUNT_MAX), disabled: raw.disabled === true || raw.disabled === 'true' });
        if (out.length >= max) break;
    }
    return out;
}
