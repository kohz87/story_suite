// Story Director v2, tracker part: lays the live pack calendar over the settings defaults and schema.

import { CALENDAR_KEYS, calendarReadOnly, gregorianFields, packCalendarFields } from './fields.js';
import { fieldHelp, packName, presetHelp } from './help.js';

/**
 * Lays the live view over the module's `defaults` and `schema` (getters, see above), and makes the
 * calendar fields read-only while Calendar is pack (calendarReadOnly). `live()` → {
 * calendar (packs.calendar's answer or null), list (packs.list or null), preset (the stored preset or
 * undefined) }, read each time a getter is; `live.calendar()` (optional) the pack calendar alone, for the
 * defaults (which every settings read evaluates).
 */
export function liveCalendarSettings(defaults, schema, live) {
    const read = () => {
        try { return live() ?? {}; } catch { return {}; }
    };
    // The defaults are read on every settings read: the fields are worked out once per burst of
    // synchronous reads (cleared on the next microtask), so a reply's many reads ask the packs once.
    let memo = null;
    const shown = () => {
        if (!memo) {
            const calendar = typeof live.calendar === 'function' ? (() => { try { return live.calendar(); } catch { return null; } })() : read().calendar;
            memo = packCalendarFields(calendar) ?? gregorianFields();
            queueMicrotask(() => { memo = null; });
        }
        return memo;
    };
    for (const field of ['era', 'months', 'leapYears', 'week']) {
        const key = CALENDAR_KEYS[field];
        if (!Object.hasOwn(defaults, key) && !schema[key]) continue;
        Object.defineProperty(defaults, key, { enumerable: true, configurable: true, get: () => structuredClone(shown()[field]) });
        const entry = schema[key];
        if (!entry) continue;
        // Read-only while Calendar is pack (Story Block's `readOnly`, SPEC §6): the pack's calendar shown,
        // not editable; Custom makes them editable, starting from what they showed.
        entry.readOnly = calendarReadOnly;
        // While read-only the row shows the calendar in use (the pack's, else Gregorian), not a calendar the
        // reader stored under Custom before; that one is kept and is back when they switch to Custom again
        // (Story Block's `shows`, display only; an older Story Block shows the stored value).
        entry.shows = values => (calendarReadOnly(values) ? structuredClone(shown()[field]) : undefined);
        const base = typeof entry.help === 'string' ? entry.help : '';
        Object.defineProperty(entry, 'help', {
            enumerable: true,
            configurable: true,
            get: () => {
                const now = read();
                return [base, fieldHelp(now.preset ?? 'pack', now.calendar)].filter(Boolean).join(' ') || undefined;
            },
        });
    }
    const choice = schema[CALENDAR_KEYS.preset];
    if (choice) {
        Object.defineProperty(choice, 'help', {
            enumerable: true,
            configurable: true,
            get: () => {
                const now = read();
                return presetHelp(now.preset ?? 'pack', now.calendar, packName(now.list, now.calendar?.pack));
            },
        });
    }
    return { defaults, schema };
}
