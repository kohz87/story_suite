// Story Director: the no-weekday reminder line for custom calendars.

// (0.9.21) About 20 tokens after the header, only for a calendar with no week: without it a
// model gives deadlines as "Friday noon", which no one in the world can count to.
export const NO_WEEKDAYS = 'This world has no weekdays: name a day by its date ({{date}}), never Monday to Sunday.';

export function noWeekLine(selection, calendar) {
    const now = selection?.now;
    // A real custom calendar only (makeCalendar's config names its preset; Gregorian has a week).
    if (calendar?.config?.preset !== 'custom' || (calendar.config.week ?? []).length) return '';
    if (typeof now !== 'number' || !Number.isFinite(now) || typeof calendar.format !== 'function') return '';
    return NO_WEEKDAYS.replace('{{date}}', calendar.format(calendar.addDays(now, 2), { time: false, era: false }));
}
