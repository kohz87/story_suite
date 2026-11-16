// Cast domain slice validator and entry-level validation helpers.

import { isInt, isRecord } from './shared-checks.js';
import { keyOf, personKey } from './keys.js';
import { NOTE_KINDS, WHYS } from './limits-notes.js';
import { MAX_ALIASES, MAX_KEY, MAX_STORED } from './limits-tables.js';
import { MAX_DOING, MAX_NAME, MAX_PLACE, MAX_REASON } from './limits-text.js';
import { slotOf } from './slice.js';

const textOk = (value, max) => typeof value === 'string' && Array.from(value).length <= max;
const timeOk = value => value === null || isInt(value);

function personProblems(key, person) {
    const at = `cast.people.${key}`;
    if (!isRecord(person) || !textOk(person.pack, MAX_NAME) || !textOk(person.eid, MAX_NAME) || personKey(person.pack, person.eid) !== key || !textOk(person.name, MAX_NAME) || !keyOf(person.name)
        || !textOk(person.ver, MAX_NAME) || !(person.sig === undefined || textOk(person.sig, 24)) || !timeOk(person.joined) || !textOk(person.where, MAX_PLACE) || !textOk(person.doing, MAX_DOING) || !timeOk(person.since)
        || typeof person.alive !== 'boolean' || !isInt(person.rev)) return [`${at} is not { pack, eid, name, ver, joined, where, doing, since, alive, met, heard, rev }.`];
    if (person.aliases !== undefined && (!Array.isArray(person.aliases) || person.aliases.length > MAX_ALIASES || person.aliases.some(alias => !textOk(alias, MAX_NAME)))) return [`${at}.aliases is a list of at most ${MAX_ALIASES} names.`];
    const { met, heard, rumored, coming, known } = person;
    if (met !== null && !(isRecord(met) && timeOk(met.on) && textOk(met.where, MAX_PLACE) && WHYS.includes(met.why) && textOk(met.reason, MAX_REASON) && isInt(met.rev) && (met.was === undefined || textOk(met.was, MAX_PLACE)))) return [`${at}.met is null or { on, where, why, reason, rev, was? }.`];
    const news = slotOf(heard);
    if (heard !== null && !(news && Array.isArray(heard) && timeOk(news.on) && textOk(news.text, MAX_DOING))) return [`${at}.heard is null or [{ on, text }].`];
    const rumor = slotOf(rumored);
    if (rumored !== undefined && rumored !== null && !(rumor && Array.isArray(rumored) && timeOk(rumor.on) && textOk(rumor.where, MAX_PLACE) && isInt(rumor.at) && rumor.at >= 0 && isInt(rumor.rev))) return [`${at}.rumored is null or [{ on, where, at, rev }].`];
    const trip = slotOf(coming);
    if (coming !== undefined && coming !== null && !(trip && Array.isArray(coming) && textOk(trip.from, MAX_PLACE) && textOk(trip.to, MAX_PLACE) && timeOk(trip.start) && isInt(trip.arrive) && textOk(trip.reason, MAX_REASON) && isInt(trip.rev))) return [`${at}.coming is null or [{ from, to, start, arrive, reason, rev }].`];
    const last = slotOf(known);
    if (known !== undefined && known !== null && !(last && Array.isArray(known) && textOk(last.where, MAX_PLACE) && timeOk(last.since))) return [`${at}.known is null or [{ where, since }].`];
    return [];
}

function noteProblems(id, note) {
    const at = `cast.notes.${id}`;
    if (!isRecord(note) || !isInt(note.at) || note.at < 0 || !NOTE_KINDS.includes(note.kind) || !textOk(note.head, 200) || !textOk(note.tag, 120)
        || !textOk(note.rest, 600) || !textOk(note.line, 200) || !isInt(note.rev)) return [`${at} is not { at, kind, head, tag, rest, line, rev }.`];
    return [];
}

/** The validator: [] or sentences. */
export function validateCast(slice) {
    if (!isRecord(slice) || !isRecord(slice.people) || !isRecord(slice.notes)) return ['cast is not { people, notes, day, meeting }.'];
    const errors = [];
    for (const [name, check] of [['people', personProblems], ['notes', noteProblems]]) {
        const keys = Object.keys(slice[name]);
        if (keys.length > MAX_STORED) errors.push(`cast.${name} holds more than ${MAX_STORED} entries.`);
        for (const key of keys) errors.push(...check(key, slice[name][key]));
    }
    const day = slotOf(slice.day);
    if (slice.day !== null && slice.day !== undefined && !(day && isInt(day.at) && isInt(day.rev))) errors.push('cast.day is null or [{ at, rev }].');
    const meeting = slotOf(slice.meeting);
    if (slice.meeting !== null && slice.meeting !== undefined && !(meeting && isInt(meeting.at) && isInt(meeting.rev) && Array.isArray(meeting.keys) && meeting.keys.length <= 4 && meeting.keys.every(key => typeof key === 'string' && key.length <= MAX_KEY))) {
        errors.push('cast.meeting is null or [{ at, keys, rev }].');
    }
    for (const key of Object.keys(slice)) if (!['people', 'notes', 'day', 'meeting'].includes(key)) errors.push(`cast has an unknown field "${key}".`);
    return errors.slice(0, 10);
}
