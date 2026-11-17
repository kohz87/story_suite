// World events, the daily step on the host: the validator of `chronicle.daily`, the step's own state (world-events switch). The
// field is optional (a chat that never stepped a day has none) and is a slot, `[state]`, so each step writes it whole. Its shape is the step's (daily/step.js): checked here for its
// kinds and its size, so a damaged save is caught without re-deriving the step. Pure.

import { isInt, isRecord } from '../domain-parts/shared-basics.js';
import { slotValue } from '../../../rpg/slot.js';

const RECORDS = ['events', 'anchors', 'lastMajor', 'cast', 'standings', 'facts', 'masks', 'cooldowns'];
const MAX_JSON = 256 * 1024;

/** `validateDaily(stored) → string[]`: `stored` is a slot, `[state]` (rpg/slot.js), written whole by each step. */
export function validateDaily(stored) {
    if (stored === undefined) return [];
    if (!Array.isArray(stored) || stored.length !== 1) return ['chronicle.daily must be a one-entry list (a slot).'];
    const slice = slotValue(stored);
    if (!isRecord(slice)) return ['chronicle.daily is not an object.'];
    const errors = [];
    if (typeof slice.seed !== 'string' || slice.seed.length > 64) errors.push('chronicle.daily.seed must be a short text.');
    if (!isInt(slice.day) || !isInt(slice.start) || slice.start > slice.day) errors.push('chronicle.daily.day and .start must be story days, start first.');
    for (const key of RECORDS) if (!isRecord(slice[key])) errors.push(`chronicle.daily.${key} must be an object.`);
    if (!Array.isArray(slice.minors) || slice.minors.some(entry => !isRecord(entry) || !isInt(entry.day) || typeof entry.region !== 'string')) errors.push('chronicle.daily.minors must be a list of { region, day }.');
    for (const [id, row] of Object.entries(isRecord(slice.events) ? slice.events : {})) {
        if (!isRecord(row) || !['dormant', 'eligible', 'active', 'ended', 'lapsed', 'replaced'].includes(row.state)) errors.push(`chronicle.daily.events["${id}"] has no known state.`);
    }
    for (const key of Object.keys(slice)) if (![...RECORDS, 'seed', 'day', 'start', 'minors'].includes(key)) errors.push(`chronicle.daily has an unknown field "${key}".`);
    if (JSON.stringify(slice).length > MAX_JSON) errors.push(`chronicle.daily is larger than ${MAX_JSON / 1024} KB.`);
    return errors.slice(0, 8);
}
