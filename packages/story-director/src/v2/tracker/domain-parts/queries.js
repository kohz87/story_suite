// Story Director v2, tracker part (domain): answers the `director` domain's queries (hash, time, calendar, threads, thread).

import { threadProjection } from '../thread-writes.js';
import { partsOf } from '../clock-set.js';
import { hashJson } from '../hash.js';
import { lineKey } from '../../../changes.js';
import { orderedThreads } from '../convert.js';
import { calendarConfig, calendarOf, packCalendarOf, settingsFrom } from '../time.js';
import { quietThreads } from '../quiet.js';
import { weekdaysAt } from '../time-parts/weekdays.js';

// Plain copies: nothing a caller changes reaches the state.
const copy = value => structuredClone(value);
const plain = thread => {
    const { track: _track, ...rest } = thread;
    return copy(rest);
};

// The chat's calendar for a query: the tracker's settings as module.js hands them to its queries
// (`tools.settings()`, defaults without it) and the packs' calendar through `tools.query`.
function queryCalendar(tools) {
    const settings = settingsFrom(typeof tools?.settings === 'function' ? tools.settings() : null);
    return { settings, pack: packCalendarOf(typeof tools?.query === 'function' ? tools.query : null) };
}

export const queries = {
    'threads.hash': (state, { thread } = {}) => {
        const found = state?.domains?.director?.threads?.[thread];
        return found ? hashJson(threadProjection(found)) : null;
    },
    /**
     * `{ minutes, text, parts }`: the story time (null until the story sets it), that time written on the
     * chat's calendar ("Goldwane 12, 611, 06:40 am"; '' while unset) and the same time as `{ year, month, day,
     * minutes }` (month and day from 1, `minutes` 0..1439 of the day), or null while unset: what the clock editor
     * shows and `director.clock` takes.
     */
    'director.time': (state, _args, tools) => {
        const minutes = state?.domains?.director?.time?.minutes ?? null;
        if (!Number.isInteger(minutes)) return { minutes: null, text: '', parts: null, weekday: '', firstWeekdays: [] };
        const { settings, pack } = queryCalendar(tools);
        const calendar = calendarOf(settings, pack);
        let text = '';
        try { text = calendar.format(minutes); } catch { text = ''; }
        const parts = partsOf(calendar, minutes);
        let days = { weekday: '', firstWeekdays: [] };
        try { if (parts) days = weekdaysAt(calendar, minutes, parts.year); } catch { /* a calendar with no week */ }
        // `weekday`: the day's name; `firstWeekdays`: for each month of this year, the index in `director.calendar`'s `week` of its first day.
        return { minutes, text, parts, ...days };
    },
    /**
     * The calendar the chat runs on, as plain data (calendar.js normalizeCalendar's shape: `preset`,
     * `era`, `months: [{ name, days }]`, `leapYears`, `week`, …): the reader's own, else the first
     * enabled pack's, else Gregorian. Other parts make it a calendar with calendar.js makeCalendar.
     */
    'director.calendar': (_state, _args, tools) => {
        const { settings, pack } = queryCalendar(tools);
        return calendarConfig(settings, pack);
    },
    /** Threads in tracker order, filtered by `kind`, `status` and `offer` when given. */
    // `open: true` (the screens' open lists): a fired beat and a dead person's own agenda or beat are left out (quiet.js).
    'director.threads': (state, { kind = null, status = null, offer = null, open = false } = {}, tools) => {
        const director = state?.domains?.director;
        const quiet = open === true ? quietThreads(director, { state, query: typeof tools?.query === 'function' ? (name, args) => tools.query(name, args) : null }) : null;
        return orderedThreads(director)
            .filter(thread => (!kind || thread.kind === kind) && (!status || thread.status === status) && (offer === null || thread.offer === offer) && !quiet?.has(thread.id))
            .map(plain);
    },
    /** One thread by `id`, or by `key` (its own or a name it was reached by), else null. */
    'director.thread': (state, { key = null, id = null } = {}) => {
        const director = state?.domains?.director;
        const found = id ? director?.threads?.[id] : director?.threads?.[director?.keys?.[lineKey(key ?? '')]];
        return found ? plain(found) : null;
    },
};
