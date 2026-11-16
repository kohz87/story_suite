// Checking the calendar and its holidays.

import { CALENDAR_FIELDS, CALENDAR_LIMITS, CALENDAR_HOLIDAY_FIELDS, CALENDAR_START_FIELDS } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isText, isObject, isInt } from '../core.js';

// The story clock's calendar: an era word, the months in order with their days, and the moment
// a new story starts. `start.month` is a month name or its number (1 = the first month); it is
// kept as the name.
export function checkCalendar(calendar, add) {
    const problems = [];
    const say = (path, message) => problems.push([path, message]);
    if (!isObject(calendar)) say('calendar', 'calendar must be { "era": …, "months": [{ "name": …, "days": … }], "start": { … } }.');
    else {
        for (const key of Object.keys(calendar)) if (!CALENDAR_FIELDS.includes(key)) say(`calendar.${key}`, `"${key}" is not a calendar field (expected ${CALENDAR_FIELDS.join(', ')}).`);
        if (calendar.era !== undefined && !isText(calendar.era, CALENDAR_LIMITS.era)) say('calendar.era', `era must be text of at most ${CALENDAR_LIMITS.era} characters, like "CY".`);
        const months = calendar.months;
        const seen = new Set();
        if (!Array.isArray(months) || !months.length || months.length > CALENDAR_LIMITS.months) say('calendar.months', `months must be a list of 1 to ${CALENDAR_LIMITS.months} { "name": …, "days": … }.`);
        else months.forEach((month, index) => {
            const at = `calendar.months[${index}]`;
            if (!isObject(month) || Object.keys(month).some(key => key !== 'name' && key !== 'days')
                || typeof month.name !== 'string' || !month.name.trim() || month.name.length > CALENDAR_LIMITS.monthName
                || !isInt(month.days, 1) || month.days > CALENDAR_LIMITS.days) return say(at, `${at} must be { "name": …, "days": 1 to ${CALENDAR_LIMITS.days} } with a name of at most ${CALENDAR_LIMITS.monthName} characters.`);
            if (seen.has(foldKey(month.name))) return say(at, `two months are called "${month.name}".`);
            seen.add(foldKey(month.name));
        });
        // The months are usable: holidays and the start can be read against them.
        const monthsOk = !problems.length;
        // Holidays: named days that come back every year, `{ name, month, day }` (month by name or number).
        if (calendar.holidays !== undefined && monthsOk) {
            const holidays = calendar.holidays;
            if (!Array.isArray(holidays) || holidays.length > CALENDAR_LIMITS.holidays) say('calendar.holidays', `holidays must be a list of at most ${CALENDAR_LIMITS.holidays} { "name", "month", "day" }.`);
            else holidays.forEach((holiday, index) => {
                const at = `calendar.holidays[${index}]`;
                if (!isObject(holiday) || Object.keys(holiday).some(key => !CALENDAR_HOLIDAY_FIELDS.includes(key))) return say(at, `${at} must be { "name", "month", "day" }.`);
                if (!holidayName(holiday.name)) say(`${at}.name`, 'name must be text (a holiday\'s name).');
                const month = monthIndexOf(months, holiday.month);
                if (month < 0) say(`${at}.month`, 'month must be one of the months, by name or by number (1 is the first).');
                else if (!isInt(holiday.day, 1) || holiday.day > months[month].days) say(`${at}.day`, `day must be a whole number from 1 to ${months[month].days}.`);
            });
        }
        if (calendar.start !== undefined && monthsOk) {
            const start = calendar.start;
            const at = 'calendar.start';
            if (!isObject(start) || Object.keys(start).some(key => !CALENDAR_START_FIELDS.includes(key))) say(at, `${at} must be { "year", "month", "day", "hour", "minute" }.`);
            else {
                const index = typeof start.month === 'string' ? months.findIndex(month => foldKey(month.name) === foldKey(start.month))
                    : isInt(start.month, 1) ? start.month - 1 : -1;
                if (!Number.isSafeInteger(start.year)) say(`${at}.year`, 'year must be a whole number.');
                if (index < 0 || index >= months.length) say(`${at}.month`, 'month must be one of the months, by name or by number (1 is the first).');
                else if (!isInt(start.day, 1) || start.day > months[index].days) say(`${at}.day`, `day must be a whole number from 1 to ${months[index].days}.`);
                if (start.hour !== undefined && (!isInt(start.hour) || start.hour > 23)) say(`${at}.hour`, 'hour must be a whole number from 0 to 23.');
                if (start.minute !== undefined && (!isInt(start.minute) || start.minute > 59)) say(`${at}.minute`, 'minute must be a whole number from 0 to 59.');
            }
        }
    }
    if (problems.length) {
        for (const [path, message] of problems) add('BAD_CALENDAR', path, message);
        return null;
    }
    const months = calendar.months.map(month => ({ name: oneLine(month.name, CALENDAR_LIMITS.monthName), days: month.days }));
    const start = calendar.start;
    const index = start === undefined ? -1 : typeof start.month === 'string' ? months.findIndex(month => foldKey(month.name) === foldKey(start.month)) : start.month - 1;
    const holidays = (calendar.holidays ?? []).map(holiday => ({ name: holidayName(holiday.name), month: months[monthIndexOf(months, holiday.month)].name, day: holiday.day }));
    return {
        era: oneLine(calendar.era ?? '', CALENDAR_LIMITS.era),
        months,
        start: start === undefined ? null : { year: start.year, month: months[index].name, day: start.day, hour: start.hour ?? 0, minute: start.minute ?? 0 },
        // Only when the pack names any, so a calendar without them reads as before.
        ...(holidays.length ? { holidays } : {}),
    };
}

// A month given by name (any case) or number (1 = the first): its index in `months`, or -1.
function monthIndexOf(months, month) {
    if (typeof month === 'string') return months.findIndex(entry => foldKey(entry.name) === foldKey(month));
    return isInt(month, 1) && month <= months.length ? month - 1 : -1;
}

// A holiday's name as kept: control and invisible marks dropped, one line, at most CALENDAR_LIMITS.holidayName
// characters; '' when that leaves nothing.
function holidayName(name) {
    return typeof name === 'string' ? oneLine(name.replace(/[\p{Cc}\p{Cf}]+/gu, ' '), CALENDAR_LIMITS.holidayName).trim() : '';
}
