// The record of dossiers Delta has made for the living cast (Story Director's director.cast, read only) and its validation.
import { FORBIDDEN_KEYS, isInt, isObject, MAX_RUNGS, NAME_MAX } from '../npc-meters-config.js';
import { CAST_KEY, metWithEntry } from '../../dossier/cast-dossier.js';

// ---- the living cast: who Delta has made a dossier for (Story Director's director.cast, read only) ----

/** Story Director's query for the pack's cast (read only). */
export const CAST_QUERY = 'director.cast';
export const CAST_MADE_MAX = 64;
/**
 * Notes the met people of Story Director's answer (`people`, normalizeCast) into the record of made dossiers: { cast, fresh }.
 * `fresh` are the met people with an entry that the record did not have yet (at most up to CAST_MADE_MAX in all); `cast` is the
 * record with them added. Nobody is ever taken out: a swipe or delete rewinds the slice itself. No answer: nothing changes.
 */
export function observeCast(memory, people) {
    const before = isObject(memory) ? memory : {};
    if (!Array.isArray(people)) return { cast: before, fresh: [] };
    const cast = { ...before };
    const fresh = [];
    for (const person of metWithEntry(people)) {
        if (Object.hasOwn(cast, person.key) || Object.keys(cast).length >= CAST_MADE_MAX) continue;
        const rungs = Math.min(MAX_RUNGS, person.entry.stages.length);
        cast[person.key] = { name: person.name, ...(rungs ? { rungs } : {}) };
        fresh.push(person);
    }
    return { cast: fresh.length ? cast : before, fresh };
}


export function validateCast(cast) {
    if (!isObject(cast)) return ['The made cast dossiers are not a record.'];
    const errors = [];
    const entries = Object.entries(cast);
    if (entries.length > CAST_MADE_MAX) errors.push(`The cast record keeps at most ${CAST_MADE_MAX} people.`);
    for (const [key, record] of entries) {
        const where = `The cast entry "${key}"`;
        if (!CAST_KEY.test(key) || FORBIDDEN_KEYS.has(key)) { errors.push(`${where} has an unusable key.`); continue; }
        if (!isObject(record) || typeof record.name !== 'string' || !record.name.trim() || record.name.length > NAME_MAX) { errors.push(`${where} has no usable name.`); continue; }
        if (record.rungs !== undefined && (!isInt(record.rungs) || record.rungs < 1 || record.rungs > MAX_RUNGS)) errors.push(`${where} has an unusable count of stages.`);
        for (const field of Object.keys(record)) if (!['name', 'rungs'].includes(field)) errors.push(`${where} has an unknown field "${field}".`);
    }
    return errors;
}
