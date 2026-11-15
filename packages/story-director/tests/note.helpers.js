// Shared fixtures and fake calendar for note*.test.js.
// A small fake of the Calendar API (12 months of 30 days, abs in minutes), enough for these
// tests; the real calendar.js is tested on its own.
const MONTHS = ['Dawnwane', 'Frostwane', 'Thawane', 'Seedwane', 'Bloomwane', 'Haywane',
    'Goldwane', 'Reapwane', 'Mistwane', 'Leafwane', 'Snowwane', 'Yearsend'];
const PARTS = { dawn: 360, morning: 540, noon: 720, afternoon: 900, dusk: 1140, evening: 1140, night: 1320, midnight: 0 };
const DAY = 1440;
const DATE = /([A-Za-z]+)\s+(\d{1,2})\b(?:,\s*(?:(\d{1,2}):(\d{2})\s*(am|pm)|([A-Za-z]+)))?/gi;

export function fakeCalendar() {
    const toAbs = ({ year, month, day, minutes = 0 }) => (year * 360 + month * 30 + day - 1) * DAY + minutes;
    const fromAbs = abs => {
        const days = Math.floor(abs / DAY);
        return { year: Math.floor(days / 360), month: Math.floor((days % 360) / 30), day: (days % 30) + 1, minutes: abs - days * DAY };
    };
    const pad = n => String(n).padStart(2, '0');
    return {
        config: { era: 'CY', months: MONTHS.map(name => ({ name, days: 30 })) },
        toAbs,
        fromAbs,
        dayIndex: abs => Math.floor(abs / DAY),
        addDays: (abs, days) => abs + days * DAY,
        format(abs, { era = true } = {}) {
            const { year, month, day, minutes } = fromAbs(abs);
            const hour = Math.floor(minutes / 60);
            return `${era ? `CY ${year}, ` : ''}${MONTHS[month]} ${day}, ${pad(hour % 12 || 12)}:${pad(minutes % 60)} ${hour < 12 ? 'am' : 'pm'}`;
        },
        parse(text, { reference = null } = {}) {
            for (const match of String(text).matchAll(DATE)) {
                const month = MONTHS.findIndex(name => name.toLowerCase() === match[1].toLowerCase());
                if (month < 0) continue;
                const day = Number(match[2]);
                let minutes = null;
                let partOfDay = null;
                if (match[3]) minutes = (Number(match[3]) % 12 + (match[5].toLowerCase() === 'pm' ? 12 : 0)) * 60 + Number(match[4]);
                else if (match[6] && match[6].toLowerCase() in PARTS) {
                    partOfDay = match[6].toLowerCase();
                    minutes = PARTS[partOfDay];
                }
                // No year written: the one that puts the date nearest the reference.
                const base = reference === null ? 0 : fromAbs(reference).year;
                const years = reference === null ? [0] : [base - 1, base, base + 1];
                const year = years.reduce((best, y) =>
                    Math.abs(toAbs({ year: y, month, day }) - reference) < Math.abs(toAbs({ year: best, month, day }) - reference) ? y : best);
                return {
                    abs: toAbs({ year, month, day, minutes: minutes ?? 0 }), year, month, day, minutes,
                    hasTime: minutes !== null, partOfDay, yearInferred: true, text: match[0],
                };
            }
            return null;
        },
    };
}

export const calendar = fakeCalendar();
// Mid-year reference, so every month name lands in year 611.
const MID = calendar.toAbs({ year: 611, month: 6, day: 1 });
export const at = text => calendar.parse(text, { reference: MID }).abs;

// A Record exactly as tracker.js shapes it.
export function record({ key, kind = 'agenda', fields = {}, ...rest }) {
    const stamp = { message: 0, time: null };
    return {
        key,
        id: key.toLowerCase(),
        kind,
        status: 'active',
        fields: { desc: '', now: '', then: '', on: '', due: '', shown: '', leg: '', arrive: '', place: '', people: '', ...fields },
        extra: {},
        created: { ...stamp },
        changed: { ...stamp },
        seen: { ...stamp },
        resolved: null,
        pinned: false,
        arc: null,
        history: [],
        ...rest,
    };
}

export function tracker(records, message = -1, time = null) {
    return { version: 1, records, message, time };
}

export function selection({ now = at('Goldwane 16, 09:00 am'), place = 'Auvoth', due = [], arriving = [], relevant = [], secrets = [] } = {}) {
    return {
        now,
        place,
        due,
        arriving,
        relevant: relevant.map((r, index) => ({ record: r, reason: 'active', priority: index + 1 })),
        dormant: [],
        secrets,
        resolvedRecently: [],
    };
}

export const lines = note => note.split('\n');
export const joined = parts => parts.map((entry, index) => (index ? entry.join : '') + entry.text).join('');

export const geva = record({ key: 'Geva', fields: { now: 'Bailiff Court', then: 'files the warrant', on: 'Goldwane 17' } });
export const brant = record({ key: 'Brant', fields: { now: 'on the frontier road with a dray', leg: 'Shorn → Auvoth 120 B, wagon 30/day → 4', arrive: 'Goldwane 19' } });
export const fires = record({ key: 'Canal Street fires', kind: 'event', fields: { now: 'curfew in force' } });
export const stranger = record({ key: 'River stranger', kind: 'hook', fields: { desc: 'who pulled Ren from the sump' } });
export const graves = record({ key: "Hollin's Reach graves", kind: 'clock', fields: { desc: 'the dead rise', due: 'Goldwane 28', shown: 'sign' } });
export const council = record({ key: 'Council session opens', kind: 'beat', fields: { on: 'Goldwane 18, 09:00 am' } });
export const sale = record({ key: "Saartje's sale", fields: { on: 'Goldwane 16' } });
export const courier = record({ key: 'Courier', fields: { leg: 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5', arrive: 'Goldwane 16, morning' } });
export const weir = record({ key: 'who sold the weir route', kind: 'secret', fields: { desc: 'Brant sold it to the guild' } });
export const debt = record({ key: "Chiyo's debt", kind: 'secret' });
