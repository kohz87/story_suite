// Story day of a dated World State, and the story-date key and calendar-age refresh built on the active calendar.
import { calendarDayNumber, extractStructuredWorldDate, getActiveCalendarConfig, storyCurrentDate, withStoryDateMemo } from '../calendar.js';
import { normalizeNpcBirthday } from '../birthday.js';

// Story day of a dated World State block in the text, or null when none is dated.
export function storyDayFromText(text, calendar = getActiveCalendarConfig()) {
    const extracted = extractStructuredWorldDate(text, calendar);
    return extracted ? calendarDayNumber(extracted.date, calendar) : null;
}

// The stored calendarAge is derived and fixed at scan time (null when the hosted clock gave no date then). A live read calls this so it
// matches what a reload derives with the clock as it is now: only calendarAge changes, in place, and only when it differs.
// The story's current date as one text (the memo key of refreshCalendarAges): one clock read, no dossier is touched.
export function storyDateKey() {
    const config = getActiveCalendarConfig();
    const date = storyCurrentDate(config);
    return `${date ? `${date.era ?? ''}|${date.year}|${date.month}|${date.day}` : ''}#${JSON.stringify(config?.months ?? null)}${config?.era ?? ''}`;
}

export const calendarAgeStats = { passes: 0 };   // dossier passes made (tests count them)

export function refreshCalendarAges(npcs) {
    if (!Array.isArray(npcs) || !npcs.length) return npcs;
    calendarAgeStats.passes += 1;
    withStoryDateMemo(() => {
        for (const npc of npcs) {
            if (!npc || typeof npc !== 'object') continue;
            const age = normalizeNpcBirthday(npc).calendarAge;
            if (age !== npc.calendarAge && (age !== undefined || npc.calendarAge !== undefined)) npc.calendarAge = age;
        }
    });
    return npcs;
}
