// The validator of `chronicle.conditions`: what a saved slice must look like. Pure.

import { isInt, isRecord } from '../domain-parts/shared-basics.js';
import { LASTING_BY } from '../domain-parts/limits-lasting.js';
import { CONDITION_NAME, MAX_CONDITIONS, MAX_PER_REF, SCOPES } from './limits.js';
import { conditionKey } from './key.js';

const FIELDS = ['name', 'scope', 'ref', 'since', 'fadesAt', 'why', 'by', 'rev', 'holds', 'open'];
const EVENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BY = /^(?:narrator|director|code)$/;

/** `validateConditions(slice) → string[]`: the field is optional (a chat without conditions has none). */
export function validateConditions(slice) {
    if (slice === undefined) return [];
    if (!isRecord(slice)) return ['chronicle.conditions is not an object.'];
    const errors = [];
    const perRef = new Map();
    for (const [key, entry] of Object.entries(slice)) {
        const at = `chronicle.conditions["${key}"]`;
        if (!isRecord(entry)) { errors.push(`${at} is not a condition.`); continue; }
        if (!CONDITION_NAME.test(entry.name ?? '')) errors.push(`${at}.name must be a declared name like "grain-dear".`);
        if (!SCOPES.includes(entry.scope)) errors.push(`${at}.scope must be one of: ${SCOPES.join(', ')}.`);
        if (typeof entry.ref !== 'string' || !entry.ref.trim() || entry.ref.length > 80) errors.push(`${at}.ref must be a name of at most 80 characters.`);
        else if (key !== conditionKey(entry.name, entry.ref)) errors.push(`${at} is kept under the wrong key.`);
        if (!isInt(entry.since)) errors.push(`${at}.since must be story minutes.`);
        if (!(entry.fadesAt === null || (isInt(entry.fadesAt) && isInt(entry.since) && entry.fadesAt > entry.since))) errors.push(`${at}.fadesAt must be null or story minutes after it began.`);
        // The daily step's holders (world events): the Active events holding it, and an "until cleared" setter while it is held.
        if (entry.holds !== undefined && !(Array.isArray(entry.holds) && entry.holds.length >= 1 && entry.holds.length <= 8 && entry.holds.every(id => typeof id === 'string' && EVENT_ID.test(id)))) errors.push(`${at}.holds must be 1 to 8 event ids.`);
        if (entry.open !== undefined && !(entry.open === true && entry.holds !== undefined)) errors.push(`${at}.open is true, and only beside holds.`);
        if (typeof entry.why !== 'string' || entry.why.length > 200) errors.push(`${at}.why must be one line of at most 200 characters.`);
        if (typeof entry.by !== 'string' || !(BY.test(entry.by) || LASTING_BY.test(entry.by))) errors.push(`${at}.by must be "event:<id>", "narrator", "director" or "code".`);
        if (!isInt(entry.rev) || entry.rev < 0) errors.push(`${at}.rev must be a whole number.`);
        for (const field of Object.keys(entry)) if (!FIELDS.includes(field)) errors.push(`${at} has an unknown field "${field}".`);
        perRef.set(entry.ref, (perRef.get(entry.ref) ?? 0) + 1);
    }
    if (Object.keys(slice).length > MAX_CONDITIONS) errors.push(`The chronicle keeps at most ${MAX_CONDITIONS} active conditions.`);
    for (const [ref, count] of perRef) if (count > MAX_PER_REF) errors.push(`"${ref}" can carry at most ${MAX_PER_REF} conditions.`);
    return errors;
}
