// The hero card's bar and status lists, cleaned and capped for drawing.

import { short } from './shared-short.js';

export const BAR_MAX = 6;
export const STATUS_MAX = 12;

/** The bars as drawn: at most BAR_MAX, each { kind, label, value, max, text }; a bar with no max or no label is kept as given. */
export function heroBars(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        out.push({ kind: typeof raw.kind === 'string' ? raw.kind : '', label: short(raw.label, 40), value: raw.value, max: raw.max, text: short(raw.text, 40) });
        if (out.length >= BAR_MAX) break;
    }
    return out;
}

export function heroStatuses(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        out.push({ label: short(raw.label, 60), icon: typeof raw.icon === 'string' ? raw.icon : '', left: raw.left, unit: typeof raw.unit === 'string' ? raw.unit : 'turns', tone: typeof raw.tone === 'string' ? raw.tone : 'accent', id: short(raw.id, 64), kind: typeof raw.kind === 'string' ? raw.kind : '' });
        if (out.length >= STATUS_MAX) break;
    }
    return out;
}
