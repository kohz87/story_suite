// Story Director v2, part screens: the calendar the view queries read dates on: the module's calendar setting, or the chat's own.

import { PRESETS, makeCalendar, normalizeCalendar } from '../../../../../modules/time/calendar.js';
import { ask } from './shared-ask.js';
import { isRecord } from './shared-words.js';

// The tracker part's calendar setting, either as that part reads it (`{ calendar: {…} }`) or as the
// module's settings hold it, namespaced by part and flattened (`'tracker.calendar.months': […]`,
// src/v2/module.js). Null when neither is there.
const CALENDAR_PREFIX = 'tracker.calendar.';
export function calendarSetting(values) {
    if (!isRecord(values)) return null;
    if (isRecord(values.calendar)) return values.calendar;
    const flat = Object.entries(values).filter(([key]) => key.startsWith(CALENDAR_PREFIX));
    return flat.length ? Object.fromEntries(flat.map(([key, value]) => [key.slice(CALENDAR_PREFIX.length), value])) : null;
}

// The chat's calendar: the tracker's `director.calendar` (the reader's, else the pack's, else Gregorian)
// when a query can ask it, else the setting itself.
export function calendarFrom(settings, query = null) {
    const config = ask(query, 'director.calendar', {}, null);
    if (isRecord(config)) {
        try { return makeCalendar(config); } catch { /* the setting below */ }
    }
    try {
        const value = typeof settings === 'function' ? settings() : settings;
        return makeCalendar(normalizeCalendar(calendarSetting(value) ?? PRESETS.gregorian));
    } catch {
        return makeCalendar(normalizeCalendar(PRESETS.gregorian));
    }
}
