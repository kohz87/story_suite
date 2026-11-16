// Story Director: calendar factory for date arithmetic, formatting and parsing.
import { normalizeCalendar } from './config.js';
import { makeParser, stripMarkdown } from './parse.js';
import { DAY_MINUTES, deepFreeze } from './shared-utils.js';

function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

// Leap years in [0, year), negative for negative years. Year 0 is a leap year (proleptic).
function leapsBefore(year) {
    const p = year - 1;
    return Math.floor(p / 4) - Math.floor(p / 100) + Math.floor(p / 400) + 1;
}

export function makeCalendar(input) {
    const config = deepFreeze(normalizeCalendar(input));
    const { months, leapYears } = config;
    const count = months.length;
    const leapMonth = count > 1 ? 1 : 0;
    const baseYear = months.reduce((sum, m) => sum + m.days, 0);
    const avgYear = baseYear + (leapYears ? 0.2425 : 0);

    // Days before each month in a common year.
    const offsets = [];
    months.reduce((sum, m, i) => (offsets[i] = sum) + m.days, 0);

    const leap = year => leapYears && isLeapYear(year);
    const daysBeforeYear = year => baseYear * year + (leapYears ? leapsBefore(year) : 0);
    const daysBeforeMonth = (year, month) => offsets[month] + (month > leapMonth && leap(year) ? 1 : 0);

    function daysInYear(year) {
        return baseYear + (leap(year) ? 1 : 0);
    }

    function daysInMonth(year, month) {
        return months[month].days + (month === leapMonth && leap(year) ? 1 : 0);
    }

    // Lenient: a month past the end rolls into the next year, a day past the end into the
    // next month, so callers can do arithmetic on the parts.
    function toAbs({ year, month, day, minutes = 0 }) {
        const y = year + Math.floor(month / count);
        const m = ((month % count) + count) % count;
        return (daysBeforeYear(y) + daysBeforeMonth(y, m) + day - 1) * DAY_MINUTES + minutes;
    }

    function fromAbs(abs) {
        // Past the exact integers the year search below cannot settle (year-- stops changing the number).
        if (!Number.isFinite(abs) || Math.abs(abs) > Number.MAX_SAFE_INTEGER) throw new RangeError(`Not a story time: ${abs}`);
        const total = Math.floor(abs / DAY_MINUTES);
        const minutes = abs - total * DAY_MINUTES;
        let year = Math.floor(total / avgYear);
        while (daysBeforeYear(year) > total) year--;
        while (daysBeforeYear(year + 1) <= total) year++;
        let rest = total - daysBeforeYear(year);
        let month = 0;
        while (month < count - 1 && rest >= daysInMonth(year, month)) rest -= daysInMonth(year, month++);
        return { year, month, day: rest + 1, minutes };
    }

    const dayIndex = abs => Math.floor(abs / DAY_MINUTES);
    const addDays = (abs, days) => abs + days * DAY_MINUTES;
    const daysBetween = (a, b) => (b - a) / DAY_MINUTES;

    // era: false leaves out the era and the year: the short form used inside the note.
    // With no era configured the year goes last, the way Gregorian dates are usually written.
    function format(abs, { time = true, era = true } = {}) {
        const d = fromAbs(abs);
        let text = `${months[d.month].name} ${d.day}`;
        if (era) text = config.era ? `${config.era} ${d.year}, ${text}` : `${text}, ${d.year}`;
        return time ? `${text}, ${formatTime(d.minutes)}` : text;
    }

    // (0.9.21) The weekday at `abs`, or '' when the world has no week. Gregorian: the real one
    // (proleptic). A custom week runs on from the epoch, shifted by weekOffset.
    function weekday(abs) {
        const { week } = config;
        if (!week.length || !Number.isFinite(abs)) return '';
        if (config.preset === 'gregorian') {
            const d = fromAbs(abs);
            const date = new Date(0);
            date.setUTCFullYear(d.year, d.month, d.day);
            return week[(date.getUTCDay() + 6) % 7];
        }
        const n = week.length;
        return week[(((dayIndex(abs) + config.weekOffset) % n) + n) % n];
    }

    /** The weekOffset that makes the day at `abs` the weekday `name` (0 if it is not in the week). */
    function weekOffsetFor(abs, name) {
        const n = config.week.length;
        const at = config.week.findIndex(day => day.toLowerCase() === String(name ?? '').trim().toLowerCase());
        if (!n || at < 0 || !Number.isFinite(abs)) return 0;
        return (((at - dayIndex(abs)) % n) + n) % n;
    }

    const parser = makeParser(config, { toAbs, fromAbs, daysInMonth });

    // (0.9.12) The date in `input` with its clock time set by the calendar: a part of the day
    // becomes its time ('Goldwane 12 sunset' → 'Goldwane 12, 07:00 pm') and a date alone runs
    // to the end of its day ('Goldwane 12, 11:59 pm'), the way deadlines are counted. A date
    // already at a clock time, or text with no date, comes back as written; words around the
    // date are kept.
    function withClock(input, { reference = null } = {}) {
        const parsed = parser(input, { reference });
        if (!parsed || (parsed.hasTime && !parsed.partOfDay)) return String(input ?? '');
        const abs = parsed.hasTime ? parsed.abs : addDays(parsed.abs, 1) - 1;
        const exact = format(abs, { era: !parsed.yearInferred });
        const text = stripMarkdown(input);
        return text.includes(parsed.text) ? text.replace(parsed.text, exact) : exact;
    }

    return Object.freeze({
        config, daysInYear, daysInMonth, toAbs, fromAbs, dayIndex, addDays, daysBetween, format,
        parse: parser, withClock, weekday, weekOffsetFor,
    });
}

function formatTime(minutes) {
    const total = Math.floor(minutes);
    const hour = Math.floor(total / 60);
    const minute = String(total % 60).padStart(2, '0');
    return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${hour < 12 ? 'am' : 'pm'}`;
}
