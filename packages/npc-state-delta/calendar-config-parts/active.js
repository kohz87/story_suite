/* The active calendar config and the Story Suite external/cached calendar source that can override it. */

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

// While another extension owns the calendar (Story Suite), its months and era replace Delta's
// own; Delta's manual fallback clock is kept when it fits them. A missing, throwing or invalid
// source leaves Delta's own calendar in effect. Without a source nothing here runs.
let externalCalendarSource = null;
let externalCalendarCache = { key: '', local: null, config: null };

export function setExternalCalendarSource(source = null) {
    externalCalendarSource = typeof source === 'function' ? source : null;
    externalCalendarCache = { key: '', local: null, config: null };
}

function externalCalendarConfig() {
    if (!externalCalendarSource) return null;
    let raw = null;
    let key = '';
    try {
        raw = externalCalendarSource();
        if (!raw || typeof raw !== 'object') return null;
        key = JSON.stringify({ era: raw.era ?? '', months: raw.months ?? null });
    } catch {
        return null;
    }
    if (key === externalCalendarCache.key && externalCalendarCache.local === activeCalendarConfig) return externalCalendarCache.config;
    const local = activeCalendarConfig;
    const shared = { era: raw.era ?? '', months: raw.months };
    const withClock = normalizeCalendarConfig({ ...shared, currentYear: local?.currentYear, currentMonth: local?.currentMonth, currentDay: local?.currentDay });
    const normalized = withClock.valid ? withClock : normalizeCalendarConfig(shared);
    const config = normalized.valid ? Object.freeze({
        ...normalized.config,
        months: Object.freeze(normalized.config.months.map(month => Object.freeze({ ...month }))),
    }) : null;
    externalCalendarCache = { key, local, config };
    return config;
}

export function getActiveCalendarConfig() {
    return externalCalendarConfig() || activeCalendarConfig;
}
