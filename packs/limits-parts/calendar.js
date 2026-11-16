// Field names and limits of a pack's story-clock calendar.

// A calendar for the story clock: { era, months: [{ name, days }], start: { year, month, day, hour, minute },
// holidays: [{ name, month, day }] } (holidays: named days that come back every year, at most 60).
export const CALENDAR_FIELDS = Object.freeze(['era', 'months', 'start', 'holidays']);
export const CALENDAR_HOLIDAY_FIELDS = Object.freeze(['name', 'month', 'day']);
export const CALENDAR_START_FIELDS = Object.freeze(['year', 'month', 'day', 'hour', 'minute']);
export const CALENDAR_LIMITS = Object.freeze({ era: 24, months: 60, monthName: 40, days: 400, holidays: 60, holidayName: 60 });
