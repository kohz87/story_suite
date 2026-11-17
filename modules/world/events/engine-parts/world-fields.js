// World events, the event fields of the pack-author spec (feature `story-director.world-events`): checked and stored.
// Nothing here fires an event: the daily trigger that reads these fields is a later job. A field that is
// absent is left out of the definition; a bad one makes the event invalid with the reason.

import { isRecord } from './shared-check.js';

const WORLD_LIMITS = Object.freeze({ text: 200, list: 16, outcomes: 8, effects: 12, cast: 8, weight: 100 });
const CERTAINTY = Object.freeze(['set-in-motion', 'likely', 'possible']);
const KINDS = Object.freeze(['one-off', 'chain-stage', 'recurring']);

const isText = value => typeof value === 'string' && value.trim() !== '' && value.length <= WORLD_LIMITS.text;
const texts = value => Array.isArray(value) && value.length <= WORLD_LIMITS.list && value.every(isText);

/** "+20%" / "-40%" / 20 → a whole signed percent within ±100, or null. */
function percentOf(value) {
    const number = typeof value === 'number' ? value : typeof value === 'string' && /^\s*[+-]?\d{1,3}\s*%?\s*$/.test(value) ? Number(value.replace(/[%\s]/g, '')) : NaN;
    return Number.isInteger(number) && Math.abs(number) <= WORLD_LIMITS.weight ? number : null;
}

function weights(map, label) {
    if (!isRecord(map) || Object.keys(map).length > WORLD_LIMITS.list) return { why: `${label} must be a record of at most ${WORLD_LIMITS.list} conditions with weights like "+20%".` };
    const out = {};
    for (const [key, value] of Object.entries(map)) {
        const percent = percentOf(value);
        if (!isText(key) || percent === null) return { why: `${label} has "${key}": ${JSON.stringify(value)}; a condition (name@place) with a whole percent from -100 to 100.` };
        out[key] = percent;
    }
    return { value: out };
}

function effects(raw) {
    if (!isRecord(raw)) return { why: 'effects must be a record with set, clear and cast lists.' };
    const out = {};
    for (const key of ['set', 'clear']) {
        if (raw[key] === undefined) continue;
        if (!Array.isArray(raw[key]) || raw[key].length > WORLD_LIMITS.effects || !raw[key].every(item => isText(item) || (isRecord(item) && isText(item.name) && isText(item.ref)))) return { why: `effects.${key} must be a list of at most ${WORLD_LIMITS.effects} conditions ("name@place: 10 days" or { name, ref }).` };
        out[key] = JSON.parse(JSON.stringify(raw[key]));
    }
    if (raw.cast !== undefined) {
        if (!Array.isArray(raw.cast) || raw.cast.length > WORLD_LIMITS.cast || !raw.cast.every(item => isRecord(item) && isText(item.who) && JSON.stringify(item).length <= 600)) return { why: `effects.cast must be a list of at most ${WORLD_LIMITS.cast} records each with a "who".` };
        out.cast = JSON.parse(JSON.stringify(raw.cast));
    }
    return { value: out };
}

function outcomes(raw) {
    if (!Array.isArray(raw) || raw.length > WORLD_LIMITS.outcomes) return { why: `outcomes must be a list of at most ${WORLD_LIMITS.outcomes} records with a name and a weight.` };
    const out = [];
    for (const item of raw) {
        if (!isRecord(item) || !isText(item.name) || !(typeof item.weight === 'number' || isText(item.weight))) return { why: 'Each outcome needs a name and a weight (a number or text such as "power:Name").' };
        out.push({ name: item.name, weight: item.weight });
    }
    return { value: out };
}

/** [field, check] for each field: `check(raw)` gives `{ value }` or `{ why }`. */
const FIELDS = [
    ['kind', raw => (KINDS.includes(raw) ? { value: raw } : { why: `kind must be one of ${KINDS.join(', ')}.` })],
    ['certainty', raw => (CERTAINTY.includes(raw) ? { value: raw } : { why: `certainty must be one of ${CERTAINTY.join(', ')}.` })],
    ['window', raw => (isRecord(raw) && Object.keys(raw).every(key => key === 'after' || key === 'within') && Object.values(raw).every(isText) && Object.keys(raw).length ? { value: { ...raw } } : { why: 'window is { after, within }, each a short text such as "emperor-dead + 3 days".' })],
    ['deadline', raw => (typeof raw === 'boolean' ? { value: raw } : { why: 'deadline must be true or false.' })],
    ['where', raw => (isText(raw) ? { value: [raw] } : texts(raw) && raw.length ? { value: [...raw] } : { why: 'where must be a place, region or realm name, or a short list of them.' })],
    ['requires', raw => (texts(raw) ? { value: [...raw] } : { why: `requires must be a list of at most ${WORLD_LIMITS.list} short texts.` })],
    ['likelier_if', raw => weights(raw, 'likelier_if')],
    ['less_if', raw => weights(raw, 'less_if')],
    ['pre_empted_by', raw => (texts(raw) ? { value: [...raw] } : { why: `pre_empted_by must be a list of at most ${WORLD_LIMITS.list} short texts.` })],
    ['outcomes', outcomes],
    ['effects', effects],
    ['ends_when', raw => (isText(raw) ? { value: raw } : { why: 'ends_when must be a short text.' })],
    ['cooldown', raw => (isText(raw) ? { value: raw } : { why: 'cooldown must be a short text such as "1 season per place".' })],
    ['summary', raw => (isText(raw) ? { value: raw } : { why: 'summary must be a short text.' })],
];

/** The spec's fields of one raw event: `{ value }` (only the fields present) or `{ why }`. */
export function worldFields(raw, id) {
    const value = {};
    for (const [field, check] of FIELDS) {
        if (raw[field] === undefined) continue;
        const result = check(raw[field]);
        if (result.why) return { why: `The event "${id}": ${result.why}` };
        value[field] = result.value;
    }
    return { value };
}
