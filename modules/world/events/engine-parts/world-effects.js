// World events, effects, outcomes and `ends_when` of the pack-author spec §3. Each parser gives `{ value }` or `{ why }`.
//   effects      { set, clear, cast, facts }: `set` as "name@ref: 10 days" or { condition, at, for }, stored as objects
//   outcomes     [{ name, weight (a number, power:<name> or score:<name>), effects?, summary? }]
//   ends_when    { for?: duration, any_of?: [anchor] }

import { isRecord } from './shared-check.js';
import { parseDuration } from './world-grammar.js';
import { parseAnchor, parseConditionRef } from './world-anchor.js';
import { knows } from './world-refs.js';

const LIMITS = Object.freeze({ text: 200, list: 12, outcomes: 8, weight: 1000 });
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAST_KEYS = Object.freeze(['who', 'location', 'status', 'goal', 'died']);
const isText = value => typeof value === 'string' && value.trim() !== '' && value.length <= LIMITS.text;

/** "name@ref: 10 days" or `{ condition, at, for }` → `{ condition, at, for }` (`for` is null, a duration text or "until cleared"). */
function setEntry(item, refs) {
    let text = item;
    let when = null;
    if (isRecord(item)) {
        if (Object.keys(item).some(key => !['condition', 'at', 'for'].includes(key)) || !isText(item.condition) || !isText(item.at)) return { why: 'a set entry object is { condition, at, for } with a condition and a place.' };
        text = `${item.condition}@${item.at}`;
        when = item.for === undefined ? null : item.for;
    } else if (typeof item === 'string' && item.includes(': ')) {
        const cut = item.lastIndexOf(': ');
        text = item.slice(0, cut);
        when = item.slice(cut + 2);
    }
    const parsed = parseConditionRef(text, refs);
    if (parsed.why) return parsed;
    if (when === null) return { value: { ...parsed.value, for: null } };
    const length = parseDuration(when, { open: true });
    return length.why ? length : { value: { ...parsed.value, for: length.value.text } };
}

/** "name@ref" or { condition, at } → `{ condition, at }`; a clear takes no duration. */
function clearEntry(item, refs) {
    if ((typeof item === 'string' && item.includes(': ')) || (isRecord(item) && item.for !== undefined)) return { why: 'a clear entry takes no duration; only set does.' };
    const entry = setEntry(item, refs);
    return entry.why ? entry : { value: { condition: entry.value.condition, at: entry.value.at } };
}

function castEntry(item, refs) {
    if (!isRecord(item) || Object.keys(item).some(key => !CAST_KEYS.includes(key)) || !isText(item.who) || Object.keys(item).length < 2) return { why: `a cast entry is { who } plus at least one of location, status, goal, died.` };
    for (const key of ['status', 'goal']) if (item[key] !== undefined && !isText(item[key])) return { why: `the cast ${key} of "${item.who}" must be a short text.` };
    if (item.died !== undefined && item.died !== true) return { why: `the cast died of "${item.who}" must be true.` };
    if (!knows(refs, ['cast'], item.who)) return { why: `the cast member "${item.who}" is not in the pack.` };
    if (item.location !== undefined && !(isText(item.location) && knows(refs, ['places', 'regions', 'realms'], item.location))) return { why: `the location "${item.location}" is not a place of the pack.` };
    return { value: { ...item } };
}

function factEntry(item) {
    if (!isRecord(item) || Object.keys(item).some(key => key !== 'id' && key !== 'text') || !NAME.test(item.id ?? '') || !isText(item.text)) return { why: 'a fact is { id, text } with a lower-case-hyphen id.' };
    return { value: { id: item.id, text: item.text } };
}

/** The `effects` record: `{ set, clear, cast, facts }`, each a short list; `clear` entries are "name@ref" or { condition, at }. */
export function parseEffects(raw, refs, label = 'effects') {
    if (!isRecord(raw) || Object.keys(raw).some(key => !['set', 'clear', 'cast', 'facts'].includes(key))) return { why: `${label} is a record with set, clear, cast and facts lists.` };
    const out = {};
    for (const [key, each] of [['set', setEntry], ['clear', clearEntry], ['cast', castEntry], ['facts', factEntry]]) {
        if (raw[key] === undefined) continue;
        if (!Array.isArray(raw[key]) || raw[key].length > LIMITS.list) return { why: `${label}.${key} must be a list of at most ${LIMITS.list} entries.` };
        const list = [];
        for (const item of raw[key]) {
            const entry = each(item, refs);
            if (entry.why) return { why: `${label}.${key}: ${entry.why}` };
            list.push(entry.value);
        }
        out[key] = list;
    }
    return { value: out };
}

/** The `outcomes` list: each `{ name, weight }` plus `effects` and `summary` when written. */
export function parseOutcomes(raw, refs) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.outcomes) return { why: `outcomes must be a list of 1 to ${LIMITS.outcomes} records with a name and a weight.` };
    const out = [];
    for (const item of raw) {
        const name = isRecord(item) ? item.name : null;
        if (!isText(name) || Object.keys(item).some(key => !['name', 'weight', 'effects', 'summary'].includes(key))) return { why: 'each outcome is { name, weight, effects?, summary? }.' };
        const weight = item.weight;
        if (typeof weight === 'number') {
            if (!(weight >= 0 && weight <= LIMITS.weight)) return { why: `the weight of "${name}" must be 0 to ${LIMITS.weight}.` };
        } else {
            const match = typeof weight === 'string' ? /^(power|score):(.+)$/.exec(weight.trim()) : null;
            if (!match || !isText(match[2])) return { why: `the weight of "${name}" is a number, "power:<name>" or "score:<name>".` };
            if (!knows(refs, [`${match[1]}s`], match[2].trim())) return { why: `the weight of "${name}" names the ${match[1]} "${match[2].trim()}", which the pack does not define.` };
        }
        if (item.summary !== undefined && !isText(item.summary)) return { why: `the summary of "${name}" must be a short text.` };
        const own = { name, weight: typeof weight === 'string' ? weight.trim() : weight };
        if (item.effects !== undefined) {
            const effects = parseEffects(item.effects, refs, `the effects of "${name}"`);
            if (effects.why) return effects;
            own.effects = effects.value;
        }
        if (item.summary !== undefined) own.summary = item.summary;
        out.push(own);
    }
    return { value: out };
}

/** `ends_when`: an object `{ for?, any_of? }` with at least one of them. */
export function parseEndsWhen(raw, refs) {
    if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'for' && key !== 'any_of') || Object.keys(raw).length === 0) return { why: 'ends_when is an object { for, any_of }, not a sentence.' };
    const out = {};
    if (raw.for !== undefined) {
        const length = parseDuration(raw.for);
        if (length.why) return { why: `ends_when.for: ${length.why}` };
        out.for = length.value.text;
    }
    if (raw.any_of !== undefined) {
        if (!Array.isArray(raw.any_of) || raw.any_of.length === 0 || raw.any_of.length > LIMITS.list) return { why: `ends_when.any_of must be a list of 1 to ${LIMITS.list} anchors.` };
        out.any_of = [];
        for (const anchor of raw.any_of) {
            const parsed = parseAnchor(anchor, refs);
            if (parsed.why) return { why: `ends_when.any_of: ${parsed.why}` };
            out.any_of.push(parsed.value);
        }
    }
    return { value: out };
}
