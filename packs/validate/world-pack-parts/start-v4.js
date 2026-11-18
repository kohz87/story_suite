// The job: checking a format 4 world pack's `content.start` beyond `start.world`: the keys it may hold, `date` (the world's "now": era, year, month number, day, hour, minute)
// and `place` (a place id of this pack). Range checks only: the month count and the day count belong to the calendar of the paired game pack (checkPairing, a later job).

import { SLUG, WORLD_START_FIELDS } from '../../limits.js';
import { isObject } from '../core.js';
import { plain } from './cast-fields.js';

const NUMBERS = { year: [0, 999999], month: [1, 99], day: [1, 999], hour: [0, 99], minute: [0, 999] };

// Says a Problem for a key `start` may not hold (with a pointer for the format 3 ones). `say(field, message, code)` is rooted at `content.start`.
function checkStartKeys(start, say) {
    for (const key of Object.keys(start)) {
        if (WORLD_START_FIELDS.keys.includes(key)) continue;
        const moved = WORLD_START_FIELDS.moved[key];
        say(key, `"${key}" is not a world start field (${WORLD_START_FIELDS.keys.join(', ')})${moved ? `: ${moved}` : ''}.`, 'UNKNOWN_FIELD');
    }
}

// `start.date` → the kept `{ era?, year, month, day, hour?, minute? }`, or null.
function checkStartDate(value, say) {
    if (!isObject(value)) return say('date', 'start.date must be { "era": "CY", "year": 611, "month": 10, "day": 1, "hour": 7 } (the month is a number).'), null;
    let good = true;
    const bad = (field, message) => { good = false; say(`date.${field}`, message); };
    for (const key of Object.keys(value)) if (!WORLD_START_FIELDS.date.includes(key)) bad(key, `"${key}" is not a start.date field (${WORLD_START_FIELDS.date.join(', ')}).`);
    const out = {};
    if (value.era !== undefined) { if (plain(value.era, 40)) out.era = value.era.trim(); else bad('era', 'era must be plain text of 1 to 40 characters.'); }
    for (const [field, [low, high]] of Object.entries(NUMBERS)) {
        if (value[field] === undefined) { if (['year', 'month', 'day'].includes(field)) bad(field, `${field} is required.`); continue; }
        if (!Number.isInteger(value[field]) || value[field] < low || value[field] > high) bad(field, `${field} must be a whole number from ${low} to ${high}${field === 'month' ? ' (a number; the paired game pack\'s calendar names it)' : ''}.`);
        else out[field] = value[field];
    }
    return good ? out : null;
}

// `start.place` → the place id, or null: it must be the id (slug) of a place this pack declares. `places`: the kept places.
function checkStartPlace(value, places, say) {
    if (typeof value !== 'string' || !SLUG.test(value)) return say('place', 'start.place must be a place id (lower-case-with-hyphens), like "bluewatch-village-guild-office".'), null;
    if (!places.some(place => place.slug === value)) return say('place', `start.place names "${value}", which is not the id of a place in this pack.`, 'UNKNOWN_REF'), null;
    return value;
}

/** The date and place of `content.start` (`raw`, whatever the file gave) → `{ date?, place? }` kept; every Problem is added. `places`: the kept places. */
export function checkStartV4(raw, places, add) {
    const say = (field, message, code = 'BAD_RECORD') => add(code, `content.start${field ? `.${field}` : ''}`, `The start: ${message}`);
    if (!isObject(raw)) return say('', 'content.start must be an object like { "date": { … }, "place": "<place id>", "world": { … } }.', 'BAD_CONTENT'), {};
    checkStartKeys(raw, say);
    const date = raw.date === undefined ? null : checkStartDate(raw.date, say);
    const place = raw.place === undefined ? null : checkStartPlace(raw.place, places, say);
    return { ...(date ? { date } : {}), ...(place ? { place } : {}) };
}
