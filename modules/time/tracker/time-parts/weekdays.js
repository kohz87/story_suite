// The story clock's weekday and the weekday each month of its year starts on (the Journal's calendar grid).

/** `{ weekday: name | '', firstWeekdays: [index into config.week] }` at story minute `abs`; `firstWeekdays` is [] when the world has no week. */
export function weekdaysAt(calendar, abs, year) {
    const week = calendar.config.week ?? [];
    if (!week.length) return { weekday: '', firstWeekdays: [] };
    const first = month => week.indexOf(calendar.weekday(calendar.toAbs({ year, month, day: 1 })));
    return { weekday: calendar.weekday(abs), firstWeekdays: calendar.config.months.map((_, month) => first(month)) };
}
