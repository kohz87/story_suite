// World events, the event fields of the pack-author spec §3 (feature `story-director.world-events`): checked and stored.
// Nothing here fires an event: the daily trigger that reads these fields is a later job. A field that is absent is left
// out of the definition; a bad one makes the event invalid with the reason. Numbers and times keep the spec's strict
// grammar (world-grammar.js), anchors and condition refs are world-anchor.js, effects/outcomes/ends_when world-effects.js.

import { isRecord } from './shared-check.js';
import { parseChance, parseDuration, parseMultiplier } from './world-grammar.js';
import { parseAnchor, parseConditionRef, parseWindowStart } from './world-anchor.js';
import { parseEffects, parseEndsWhen, parseOutcomes } from './world-effects.js';
import { knows } from './world-refs.js';

const LIST = 16;
const TEXT = 200;
const ENUMS = Object.freeze({
    kind: ['one-off', 'chain-stage', 'recurring'],
    certainty: ['set-in-motion', 'likely', 'possible'],
    reach: ['local', 'regional', 'realm', 'world'],
    severity: ['minor', 'major'],
    anchor_mode: ['first', 'each'],
});
const FIT = 'where conditions fit';
const isText = value => typeof value === 'string' && value.trim() !== '' && value.length <= TEXT;
const enumCheck = field => raw => (ENUMS[field].includes(raw) ? { value: raw } : { why: `${field} must be one of ${ENUMS[field].join(', ')}.` });

/** `list(item)` over a short list of values → `{ value: [...] }` or the first `{ why }`. */
function listOf(raw, label, each, { least = 0 } = {}) {
    if (!Array.isArray(raw) || raw.length < least || raw.length > LIST) return { why: `${label} must be a list of ${least === 0 ? 'at most' : `${least} to`} ${LIST} entries.` };
    const value = [];
    for (const item of raw) {
        const result = each(item);
        if (result.why) return { why: `${label}: ${result.why}` };
        value.push(result.value);
    }
    return { value };
}

/** `likelier_if` / `less_if`: { "<condition>@<ref>" or anchor: "×N" } → the same keys with numbers. */
function odds(raw, label, refs) {
    if (!isRecord(raw) || Object.keys(raw).length > LIST) return { why: `${label} must be a record of at most ${LIST} entries like { "unrest@Highmark Capital": "×1.5" }.` };
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const where = key.includes('@') && !/^(set|cleared):/.test(key) ? parseConditionRef(key, refs) : parseAnchor(key, refs);
        if (where.why) return { why: `${label}: ${where.why}` };
        const times = parseMultiplier(value);
        if (times.why) return { why: `${label} "${key}": ${times.why}` };
        out[key] = times.value;
    }
    return { value: out };
}

function requirement(item, refs) {
    if (typeof item === 'string' && item.includes(':') && !item.includes('@')) return parseAnchor(item, refs, { allowStage: true });
    if (typeof item === 'string' && /^(set|cleared):/.test(item)) return parseAnchor(item, refs);
    const parsed = parseConditionRef(item, refs);
    return parsed.why ? parsed : { value: `${parsed.value.condition}@${parsed.value.at}` };
}

function where(raw, refs) {
    if (raw === FIT) return { value: FIT };
    const names = typeof raw === 'string' ? [raw] : raw;
    return listOf(names, 'where', item => (isText(item) && knows(refs, ['places', 'routes', 'regions', 'realms'], item) ? { value: item.trim() } : { why: `"${item}" is not a place, region or realm of the pack.` }), { least: 1 });
}

function window(raw, refs) {
    if (!isRecord(raw) || Object.keys(raw).some(key => key !== 'after' && key !== 'within') || raw.within === undefined) return { why: 'window is { after, within }: after an anchor (such as "died:adalmar + 3 days"), within a duration.' };
    const within = parseDuration(raw.within);
    if (within.why) return { why: `window.within: ${within.why}` };
    if (raw.after === undefined) return { value: { within: within.value.text } };
    const after = parseWindowStart(raw.after, refs);
    return after.why ? { why: `window.after: ${after.why}` } : { value: { after: after.value, within: within.value.text } };
}

function cooldown(raw) {
    const match = typeof raw === 'string' ? /^(.+?)( per place)?$/.exec(raw.trim()) : null;
    const length = match ? parseDuration(match[1]) : { why: 'cooldown must be a duration such as "1 season per place".' };
    return length.why ? { why: `cooldown: ${length.why}` } : { value: raw.trim() };
}

/** [field, check(raw, refs)] in checking order; `check` gives `{ value }` or `{ why }`. */
const FIELDS = [
    ['kind', enumCheck('kind')], ['certainty', enumCheck('certainty')], ['reach', enumCheck('reach')], ['severity', enumCheck('severity')], ['anchor_mode', enumCheck('anchor_mode')],
    ['where', where],
    ['requires', (raw, refs) => listOf(raw, 'requires', item => requirement(item, refs))],
    ['window', window],
    ['chance', parseChance],
    ['likelier_if', (raw, refs) => odds(raw, 'likelier_if', refs)],
    ['less_if', (raw, refs) => odds(raw, 'less_if', refs)],
    ['pre_empted_by', (raw, refs) => listOf(raw, 'pre_empted_by', item => parseAnchor(item, refs))],
    ['outcomes', parseOutcomes],
    ['effects', (raw, refs) => parseEffects(raw, refs)],
    ['ends_when', parseEndsWhen],
    ['cooldown', cooldown],
    ['summary', raw => (isText(raw) ? { value: raw.trim() } : { why: 'summary must be a short text.' })],
];

/** What the fields say about each other: the kind decides which of window, cooldown and where apply; certainty decides chance. */
function together(value) {
    if (value.kind === 'recurring') {
        if (value.window) return 'a recurring event has no window; give it a chance "per season" and a cooldown.';
        if (!value.cooldown) return 'a recurring event needs a cooldown such as "1 season per place".';
        if (value.chance && value.chance.per !== 'season') return 'a recurring event rolls "per season", not "over the window".';
    } else {
        if (value.where === FIT) return `"${FIT}" is for recurring events only.`;
        if (value.chance && value.chance.per !== 'window') return 'chance "per season" is for recurring events; write "over the window".';
        if (value.chance && !value.window) return 'chance "over the window" needs a window.';
    }
    if (value.kind === 'chain-stage' && !(value.requires ?? []).some(item => item.startsWith('stage:'))) return 'a chain-stage requires "stage:<previous event id>".';
    if (value.certainty === 'set-in-motion' && value.chance) return 'a set-in-motion event is certain; drop the chance (its window end is the deadline).';
    return '';
}

/** The spec's fields of one raw event against the pack's names `refs`: `{ value }` (only the fields present) or `{ why }`. */
export function worldFields(raw, id, refs = {}) {
    const value = {};
    for (const [field, check] of FIELDS) {
        if (raw[field] === undefined) continue;
        const result = check(raw[field], refs);
        if (result.why) return { why: `The event "${id}": ${result.why}` };
        value[field] = result.value;
    }
    if (raw.deadline !== undefined) return { why: `The event "${id}": deadline is not a field; the end of the window is the deadline for a set-in-motion event.` };
    const clash = together(value);
    return clash ? { why: `The event "${id}": ${clash}` } : { value };
}
