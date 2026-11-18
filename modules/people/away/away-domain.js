// The `away` domain: who is away from the scene (anyone the narrator marks away, followed or not) and the last absence of who came back.
//
// away = {
//   away: { [key]: { name, doing, since, back, steps: [{ date, text }], rev } },     // away now
//   home: { [key]: { name, doing, since, back, steps, on, rev } },                  // the last absence of someone who is back (the newest MAX_HOME)
// }
// `key` is `lineKey(name)`. A record is added whole under its key and one that goes is removed whole; a change inside one is marked
// `ctx.ifThere`, so a reply deleted in the middle never breaks the replies after it. Times are story minutes, or null while the clock
// is not set; `back` is the start of the day they are due, or null. `on`: when they came back.

import { keyOf } from './away-text.js';

export const LIMITS = Object.freeze({ name: 80, doing: 160, step: 140, steps: 12, stored: 200, home: 30 });

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = value => Number.isSafeInteger(value);
const textOk = (value, max) => typeof value === 'string' && Array.from(value).length <= max;
const timeOk = value => value === null || isInt(value);

export const initialAway = () => ({ away: {}, home: {} });

/** The slice with both tables there (an older or empty one reads as empty). */
export function tables(slice) {
    const own = isRecord(slice) ? slice : {};
    return { away: isRecord(own.away) ? own.away : {}, home: isRecord(own.home) ? own.home : {} };
}

function recordProblems(table, key, record) {
    const at = `away.${table}.${key}`;
    if (!isRecord(record) || !textOk(record.name, LIMITS.name) || keyOf(record.name) !== key || !textOk(record.doing, LIMITS.doing) || !timeOk(record.since) || !timeOk(record.back) || !isInt(record.rev)) return [`${at} is not { name, doing, since, back, steps, rev }.`];
    if (!Array.isArray(record.steps) || record.steps.length > LIMITS.steps || record.steps.some(step => !isRecord(step) || !timeOk(step.date) || !textOk(step.text, LIMITS.step))) return [`${at}.steps is a list of at most ${LIMITS.steps} { date, text }.`];
    if (table === 'home' && !timeOk(record.on)) return [`${at}.on is a story minute or null.`];
    return [];
}

/** The validator: [] or sentences. */
export function validateAway(slice) {
    if (!isRecord(slice) || !isRecord(slice.away) || !isRecord(slice.home)) return ['away is not { away, home }.'];
    const errors = [];
    for (const table of ['away', 'home']) {
        const keys = Object.keys(slice[table]);
        if (keys.length > LIMITS.stored) errors.push(`away.${table} holds more than ${LIMITS.stored} entries.`);
        for (const key of keys) errors.push(...recordProblems(table, key, slice[table][key]));
    }
    for (const key of Object.keys(slice)) if (key !== 'away' && key !== 'home') errors.push(`away has an unknown field "${key}".`);
    return errors.slice(0, 10);
}
