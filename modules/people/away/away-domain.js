// The `away` domain: who is away from the scene (anyone the narrator marks away, followed or not) and the last absence of who came back.
//
// away = { away: { [aw_id]: { name, doing, since, back, steps: [{ date, text }], rev, home? } } }
// Each absence is its own record under a new id, added whole; `home` (the story minute they came back, or null) marks it ended. Every change
// inside a record (news, a new date, the return) is marked `ctx.ifThere`, so when the reply that sent someone away is deleted, the later
// replies' news and return about that absence are passed over and the rest of the story stands. Times are story minutes, or null while the
// clock is not set; `back` is the start of the day they are due, or null. At most one open absence per name; the newest LIMITS.home ended ones are kept.

import { keyOf } from './away-text.js';

export const LIMITS = Object.freeze({ name: 80, doing: 160, step: 140, steps: 12, stored: 200, home: 30 });

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = value => Number.isSafeInteger(value);
const textOk = (value, max) => typeof value === 'string' && Array.from(value).length <= max;
const timeOk = value => value === null || isInt(value);

export const initialAway = () => ({ away: {} });

/**
 * The records by name key: `{ away: { [key]: record & { id } }, home: { [key]: record & { id } } }` — the open absences, and for each name the
 * newest ended one (by rev). An older or empty slice reads as empty.
 */
export function tables(slice) {
    const own = isRecord(slice) && isRecord(slice.away) ? slice.away : {};
    const away = {};
    const home = {};
    for (const [id, record] of Object.entries(own)) {
        const key = isRecord(record) ? keyOf(record.name) : '';
        if (!key) continue;
        if (!Object.hasOwn(record, 'home')) { away[key] = { ...record, id }; continue; }
        if (!home[key] || (record.rev ?? 0) > (home[key].rev ?? 0)) home[key] = { ...record, id };
    }
    return { away, home };
}

function recordProblems(id, record) {
    const at = `away.away.${id}`;
    if (!/^aw_[0-9a-z]{8}$/.test(id)) return [`${at}: an absence id is aw_ and eight letters or digits.`];
    if (!isRecord(record) || !textOk(record.name, LIMITS.name) || !keyOf(record.name) || !textOk(record.doing, LIMITS.doing) || !timeOk(record.since) || !timeOk(record.back) || !isInt(record.rev)) return [`${at} is not { name, doing, since, back, steps, rev }.`];
    if (!Array.isArray(record.steps) || record.steps.length > LIMITS.steps || record.steps.some(step => !isRecord(step) || !timeOk(step.date) || !textOk(step.text, LIMITS.step))) return [`${at}.steps is a list of at most ${LIMITS.steps} { date, text }.`];
    if (Object.hasOwn(record, 'home') && !timeOk(record.home)) return [`${at}.home is a story minute or null.`];
    return [];
}

/** The validator: [] or sentences. */
export function validateAway(slice) {
    if (!isRecord(slice) || !isRecord(slice.away)) return ['away is not { away }.'];
    const errors = [];
    const ids = Object.keys(slice.away);
    if (ids.length > LIMITS.stored) errors.push(`away.away holds more than ${LIMITS.stored} entries.`);
    for (const id of ids) errors.push(...recordProblems(id, slice.away[id]));
    const open = ids.filter(id => isRecord(slice.away[id]) && !Object.hasOwn(slice.away[id], 'home')).map(id => keyOf(slice.away[id].name));
    if (new Set(open).size !== open.length) errors.push('away.away holds two open absences for one name.');
    for (const key of Object.keys(slice)) if (key !== 'away') errors.push(`away has an unknown field "${key}".`);
    return errors.slice(0, 10);
}
