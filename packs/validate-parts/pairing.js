// The job: the pairing check (pack format 4, §4.2). A world pack and a game pack are checked against each other: the world's dates, season anchors,
// birthdays and culture regions against the game's calendar, seasons and names. Pure: no settings, no state, no model.
//
// `checkPairing(world, game)` → `{ errors, warnings, info }`. `world` and `game` are the normalized packs from `validatePack` (`game` null means the built-in
// game: a Gregorian calendar with the four quarter seasons). It never blocks play: each entry names the one part to switch off
// (`part: { kind, id }`: an event or template that never fires, a start date that falls back, a birthday that is dropped, a culture left unused).

import { foldKey } from '../../core/text.js';
import { GREGORIAN } from '../validate/world-pack-parts/date-anchor.js';
import { parseEntry } from '../validate/world-pack-parts/grammar.js';
import { gregorianLeap } from '../content-parts/gregorian.js';

const QUARTERS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

/** The calendar a pair plays on: the game's months and season names, or the built-in ones. */
function calendarOf(game) {
    const own = game?.calendar?.months?.length ? game.calendar : null;
    const seasons = own?.seasons?.length ? own.seasons.map(season => foldKey(season.name)) : QUARTERS;
    return { builtIn: !own, months: own ? own.months : GREGORIAN, seasons: new Set(seasons), name: own ? `${game.name || game.id}'s calendar` : 'the built-in Gregorian calendar' };
}

/** A month given by number or name → its index in `months`, or -1. */
function monthIndex(months, token) {
    const text = String(token).trim();
    if (/^\d+$/.test(text)) { const at = Number(text) - 1; return at >= 0 && at < months.length ? at : -1; }
    return months.findIndex(month => foldKey(month.name) === foldKey(text));
}

/** What is wrong with a month and day on the calendar, in words, or '' when both exist. */
function dateProblem(calendar, month, day) {
    const at = monthIndex(calendar.months, month);
    if (at < 0) return `${typeof month === 'number' || /^\d+$/.test(String(month)) ? `${calendar.name} has ${calendar.months.length} months, not ${month}` : `"${month}" is not a month of ${calendar.name} (${calendar.months.map(entry => entry.name).join(', ')})`}`;
    if (!(Number(day) >= 1) || Number(day) > calendar.months[at].days) return `${calendar.months[at].name} has ${calendar.months[at].days} days in ${calendar.name}, so day ${day} never comes`;
    return '';
}

/** The anchor strings an event or template reads, with the field each came from. */
function anchorTexts(record) {
    const out = [];
    const add = (field, value) => { if (typeof value === 'string') out.push([field, value]); };
    add('on', record.on);
    add('window.after', record.window?.after);
    for (const field of ['requires', 'requires_any', 'pre_empted_by', 'needs']) if (Array.isArray(record[field])) record[field].forEach((text, n) => add(`${field}[${n}]`, text));
    if (Array.isArray(record.ends_when?.any_of)) record.ends_when.any_of.forEach((text, n) => add(`ends_when.any_of[${n}]`, text));
    for (const field of ['likelier_if', 'less_if']) for (const key of Object.keys(record[field] ?? {})) add(`${field}.${key}`, key);
    return out;
}

/** One event or template: each date or season anchor that does not fit the calendar is an error (the record never fires). */
function checkRecords(list, path, idKey, calendar, errors) {
    (Array.isArray(list) ? list : []).forEach((record, n) => {
        for (const [field, text] of anchorTexts(record)) {
            const entry = parseEntry(text);
            if (entry.type !== 'anchor' || entry.error) continue;
            const part = { kind: idKey === 'template' ? 'template' : 'event', id: record[idKey] ?? record.id ?? '' };
            const at = `${path}[${n}].${field}`;
            if (entry.kind === 'date') {
                const match = /^(\d+)-([^-]+)-(\d+)$/.exec(entry.id);
                const problem = match ? dateProblem(calendar, match[2], match[3]) : '';
                if (problem) errors.push({ code: 'PAIR_EVENT_DATE', path: at, part, message: `"${text}": ${problem}. This ${part.kind} never fires in this pair.` });
            } else if (entry.kind === 'season' && !calendar.seasons.has(foldKey(entry.id))) {
                errors.push({ code: 'PAIR_EVENT_SEASON', path: at, part, message: `"${text}": "${entry.id}" is not a season of ${calendar.name} (${[...calendar.seasons].join(', ')}). This ${part.kind} never fires in this pair.` });
            }
        }
    });
}

/** The ids, names and aliases the world's regions answer to (and the region ids its places name), folded. */
function regionKeys(world) {
    const keys = new Set();
    for (const region of world?.content?.regions ?? []) for (const name of [region.id, region.name, ...(region.aliases ?? [])]) keys.add(foldKey(name));
    for (const place of world?.content?.places ?? []) if (place.region) keys.add(foldKey(place.region));
    return keys;
}

/**
 * The world's calendar-dependent parts against the game's calendar and names.
 * @param {object|null} world a normalized world pack (kind "world"); null checks nothing.
 * @param {object|null} game a normalized game pack, or null for the built-in game.
 * @returns {{ errors: object[], warnings: object[], info: object[] }} each `{ code, path, message, part: { kind, id } }`.
 */
export function checkPairing(world, game) {
    const errors = [], warnings = [], info = [];
    if (!world) return { errors, warnings, info };
    const calendar = calendarOf(game);

    const date = world.start?.date;
    if (date) {
        // (the built-in game reads the date on the Gregorian calendar, where February 29 comes only in a leap year)
        const leapless = calendar.builtIn && Number(date.month) === 2 && Number(date.day) === 29 && !gregorianLeap(date.year);
        const problem = leapless ? `February has 28 days in ${date.year} on ${calendar.name}, so day 29 never comes` : dateProblem(calendar, date.month, date.day);
        if (problem) errors.push({ code: 'PAIR_START_DATE', path: 'content.start.date', part: { kind: 'start', id: 'date' }, message: `The start date (month ${date.month}, day ${date.day}): ${problem}. The chat starts on day 1 of month 1 of year ${date.year}.` });
    }
    checkRecords(world.content?.worldEvents, 'content.worldEvents', 'id', calendar, errors);
    checkRecords(world.content?.templates, 'content.templates', 'template', calendar, errors);

    (world.content?.cast ?? []).forEach((person, n) => {
        if (typeof person.birthday !== 'string') return;
        const cut = person.birthday.lastIndexOf(' ');
        const problem = dateProblem(calendar, person.birthday.slice(0, cut), person.birthday.slice(cut + 1));
        if (problem) warnings.push({ code: 'PAIR_BIRTHDAY', path: `content.cast[${n}].birthday`, part: { kind: 'birthday', id: person.id ?? '' }, message: `${person.name || person.id}'s birthday "${person.birthday}": ${problem}. The birthday is dropped.` });
    });

    const regions = regionKeys(world);
    const names = game?.content?.names ?? {};
    for (const culture of Object.keys(names).filter(key => key !== 'banned')) {
        const missing = (names[culture].regions ?? []).filter(region => !regions.has(foldKey(region)));
        if (missing.length === (names[culture].regions ?? []).length) warnings.push({ code: 'PAIR_CULTURE', path: `content.names.${culture}.regions`, part: { kind: 'culture', id: culture }, message: `The names culture "${culture}" names no region of ${world.name || world.id} (${missing.join(', ')}). It is unused.` });
    }

    const wanted = world.recommends?.game;
    if (wanted && wanted.id !== game?.id) info.push({ code: 'PAIR_RECOMMENDS', path: 'recommends.game', part: { kind: 'game', id: wanted.id }, message: `${world.name || world.id} recommends ${wanted.id} rules.` });
    return { errors, warnings, info };
}
