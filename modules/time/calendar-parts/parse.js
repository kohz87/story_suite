// Story Director: lenient date and time-of-day parser for story calendars.
import { escapeRegExp } from './shared-utils.js';

// A written year past this is not a date (its minutes would pass the exact integers).
const MAX_PARSED_YEAR = 1e9;

export function stripMarkdown(text) {
    return String(text)
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links keep their text
        .replace(HTML_TAG, ' ')
        .replace(/<([^<>]*)>/g, ' $1 ')              // a date in angle brackets, as Story Director writes it
        .replace(/[*_`~#<>]+/g, '');
}

// A real tag (`<br>`, `</i>`, `<a href="x">`): a name, then only name=value attributes. `<CY 611, Goldwane 12>` is no tag.
const HTML_TAG = /<\/?[a-z][a-z0-9]*(?:\s+[\w:-]+=(?:"[^"]*"|'[^']*'|[^\s>]*))*\s*\/?>/gi;

const TIME_LEAD = /^[\s,;@–—-]*(?:(?:at|by|around|about|on|in\s+the)\s+)?/iu;
const TIME_TRAIL = /^[\s,;@–—-]*(?:(?:on|of)\s+)?$/iu;
const NUMERIC_TIME = /(?<![\p{L}\d:.])(\d{1,2})(?::([0-5]\d))?(?:\s*([ap])\.?\s?m\.?)?(?![\p{L}\d:])/giu;

export function makeParser(config, { toAbs, fromAbs, daysInMonth }) {
    const names = config.months.map(m => m.name.toLowerCase().replace(/\s+/g, ' '));
    const parts = config.partsOfDay;

    // Full names first (longest first, so 'Month 12' beats 'Month 1'), then any word that
    // might be a prefix. resolveMonth decides; the regex only finds candidates.
    const fullNames = [...config.months.map(m => m.name)]
        .sort((a, b) => b.length - a.length)
        .map(name => escapeRegExp(name).replace(/\s+/g, '\\s+'));
    const MONTH = `(?<m>${[...fullNames, "\\p{L}[\\p{L}'’]{2,}"].join('|')})(?![\\p{L}\\d])\\.?`;
    const DAY = '(?<d>\\d{1,2})(?:st|nd|rd|th)?(?![\\p{L}\\d])';
    const ERA = config.era ? `${escapeRegExp(config.era).replace(/\s+/g, '\\s*')}\\.?\\s*(?<y1>-?\\d+)` : null;
    // Without an era a year needs three digits, so '5, Goldwane 3' or '12 Goldwane 5 pm'
    // do not read a year out of a stray number.
    const BARE_YEAR = '(?<y2>\\d{3,})(?![\\p{L}\\d:])';
    const YEAR = ERA ? `(?:${ERA}|${BARE_YEAR})` : BARE_YEAR;
    const TAIL = `(?:(?:\\s*,\\s*|\\s+)${YEAR})?`;

    const patterns = [
        // [ERA] YEAR, Month D
        `(?<![\\p{L}\\d])(?:${ERA ? `${ERA}|` : ''}(?<y2>\\d{3,})(?=\\s*,))\\s*,?\\s*${MONTH}\\s+${DAY}`,
        // Month D[, YEAR]
        `(?<![\\p{L}\\d])${MONTH}\\s+${DAY}${TAIL}`,
        // D Month [YEAR]
        `(?<![\\p{L}\\d:.])${DAY}\\s+(?:of\\s+)?${MONTH}${TAIL}`,
    ].map(source => new RegExp(source, 'giu'));

    const partNames = Object.keys(parts).sort((a, b) => b.length - a.length).map(escapeRegExp);
    const PART_TIME = new RegExp(`(?<![\\p{L}])(${partNames.join('|')})(?![\\p{L}])`, 'giu');

    function resolveMonth(word) {
        const w = word.toLowerCase().replace(/\s+/g, ' ');
        const exact = names.indexOf(w);
        if (exact >= 0) return exact;
        // 'night' or 'dawn' is a part of day, never a shortened Nightfall or Dawnwane.
        if (w.length < 3 || Object.hasOwn(parts, w)) return -1;
        const hits = names.flatMap((name, i) => (name.startsWith(w) ? [i] : []));
        return hits.length === 1 ? hits[0] : -1;
    }

    // Every time in the text, in order: numeric times and parts of day.
    function scanTimes(text) {
        const found = [];
        for (const m of text.matchAll(NUMERIC_TIME)) {
            const hour = Number(m[1]);
            const minute = m[2] === undefined ? 0 : Number(m[2]);
            let minutes = null;
            if (m[3]) {
                if (hour >= 1 && hour <= 12) minutes = (hour % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0)) * 60 + minute;
            } else if (m[2] !== undefined && hour < 24) {
                minutes = hour * 60 + minute;
            }
            if (minutes !== null) found.push({ index: m.index, end: m.index + m[0].length, minutes, partOfDay: null });
        }
        for (const m of text.matchAll(PART_TIME)) {
            const name = m[1].toLowerCase();
            found.push({ index: m.index, end: m.index + m[0].length, minutes: parts[name], partOfDay: name });
        }
        return found.sort((a, b) => a.index - b.index);
    }

    // A time right after the date ('Goldwane 13, dusk') or right before it ('dusk on Goldwane 13').
    function adjacentTime(text, start, end) {
        const rest = text.slice(end);
        const lead = TIME_LEAD.exec(rest)[0].length;
        const after = scanTimes(rest).find(t => t.index === lead);
        if (after) return { ...after, index: start, end: end + after.end };
        const before = text.slice(0, start);
        const hit = scanTimes(before).filter(t => TIME_TRAIL.test(before.slice(t.end))).pop();
        return hit ? { ...hit, index: hit.index, end } : null;
    }

    // No year written: the year that puts the date nearest the reference. A few years either
    // way, so February 29 still finds a leap year.
    function inferYear(month, day, minutes, reference) {
        if (reference === null) return day <= daysInMonth(0, month) ? 0 : null;
        const year = fromAbs(reference).year;
        let best = null;
        for (const y of [year, year + 1, year - 1, year + 2, year - 2, year + 3, year - 3,
            year + 4, year - 4, year + 8, year - 8]) {
            if (day > daysInMonth(y, month)) continue;
            const distance = Math.abs(toAbs({ year: y, month, day, minutes }) - reference);
            if (!best || distance < best.distance) best = { year: y, distance };
        }
        return best ? best.year : null;
    }

    function result({ year, month, day, time, yearInferred, text }) {
        const minutes = time ? time.minutes : null;
        return {
            abs: toAbs({ year, month, day, minutes: minutes ?? 0 }),
            year, month, day, minutes,
            hasTime: Boolean(time),
            partOfDay: time ? time.partOfDay : null,
            yearInferred,
            text,
        };
    }

    function dateAt(text, match, reference) {
        const month = resolveMonth(match.groups.m);
        if (month < 0) return null;
        const day = Number(match.groups.d);
        if (day < 1) return null;
        const written = match.groups.y1 ?? match.groups.y2;
        const start = match.index;
        const time = adjacentTime(text, start, start + match[0].length);
        const minutes = time ? time.minutes : 0;
        const year = written !== undefined ? Number(written) : inferYear(month, day, minutes, reference);
        if (year === null || Math.abs(year) > MAX_PARSED_YEAR || day > daysInMonth(year, month)) return null;
        const from = time ? Math.min(time.index, start) : start;
        const to = time ? time.end : start + match[0].length;
        return result({ year, month, day, time, yearInferred: written === undefined, text: text.slice(from, to) });
    }

    return function parse(input, { reference = null } = {}) {
        if (typeof input !== 'string' || !input.trim()) return null;
        if (typeof reference !== 'number' || !Number.isFinite(reference)) reference = null;
        const text = stripMarkdown(input);

        // Earliest date wins; at the same spot, the longer reading ('CY 611, Haywane 12').
        const candidates = [];
        for (const regex of patterns) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text))) {
                candidates.push(match);
                regex.lastIndex = match.index + 1;   // overlapping readings stay candidates
            }
        }
        candidates.sort((a, b) => a.index - b.index || b[0].length - a[0].length);
        for (const match of candidates) {
            const date = dateAt(text, match, reference);
            if (date) return date;
        }

        // A bare time or part of day: the reference's day. Without a reference there is no day.
        const time = scanTimes(text)[0];
        if (!time || reference === null) return null;
        const { year, month, day } = fromAbs(reference);
        return result({ year, month, day, time, yearInferred: true, text: text.slice(time.index, time.end) });
    };
}
