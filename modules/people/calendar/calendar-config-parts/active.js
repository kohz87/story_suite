/* The active calendar config: the saved calendar NPC State reads its dates on. */

import { normalizeCalendarConfig } from './normalize.js';

let activeCalendarConfig = null;

export function setActiveCalendarConfig(raw = null) {
    if (!raw) {
        activeCalendarConfig = null;
        return null;
    }
    const normalized = normalizeCalendarConfig(raw, { requireCurrentDate: false });
    activeCalendarConfig = normalized.valid ? Object.freeze({
        ...normalized.config,
        months: Object.freeze(normalized.config.months.map(month => Object.freeze({ ...month }))),
    }) : null;
    return activeCalendarConfig;
}

export function getActiveCalendarConfig() {
    return activeCalendarConfig;
}
