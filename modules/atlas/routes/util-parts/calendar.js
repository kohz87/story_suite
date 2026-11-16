// Calendar-abs conversion and day-minute arithmetic for route helpers.

export const DAY_MINUTES = 1440;

export function toAbs(value, calendar, reference = null) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && calendar) return calendar.parse(value, { reference })?.abs ?? null;
    return null;
}

// To the minute: hours in thirds and quarters must not land on 09:59.
export function addDays(abs, days, calendar) {
    return Math.round(calendar?.addDays ? calendar.addDays(abs, days) : abs + days * DAY_MINUTES);
}
