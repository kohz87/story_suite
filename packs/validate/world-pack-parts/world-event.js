// The job: checking one `content.worldEvents` entry (spec §3) and returning it as kept (a plain copy; every field is kept).
// The shape rules live here; what a reference names is asked of the shared entry checks.

import { EVENT_CERTAINTY, EVENT_KINDS, EVENT_REACH, SLUG, WORLD_EVENT_FIELDS, WORLD_LIMITS } from '../../limits.js';
import { durationDays } from '../../../modules/world/daily/durations.js';
import { isObject, isText } from '../core.js';
import { checkAnchorText, checkEntry } from './entries.js';
import { checkEffects } from './effects.js';

const CHANCE = /^(\d{1,3}(?:\.\d+)?)% (over the window|per season)$/;
const MODIFIER = /^×(\d+(?:\.\d+)?)$/;
const SENTENCE = (value, max) => isText(value, max) && value.trim().length > 0;

function whereOf(record, ctx, say, kind) {
    const where = record.where;
    if (where === undefined) return;
    if (where === 'where conditions fit') { if (kind !== 'recurring') say('where', '"where conditions fit" is for a recurring event; name the places, regions or realms.'); return; }
    if (isObject(where)) {
        for (const key of Object.keys(where)) if (!['kinds', 'region', 'realm'].includes(key)) say(`where.${key}`, `"${key}" is not a where field (kinds, region, realm).`, 'UNKNOWN_FIELD');
        if (!Array.isArray(where.kinds) || !where.kinds.length) say('where.kinds', 'where.kinds must be a list of place kinds.');
        else for (const word of where.kinds) if (!ctx.index.placeKindKnown(word)) say('where.kinds', `where.kinds names "${String(word)}", which is not in placeKinds and is not an engine class.`, 'UNKNOWN_REF');
        for (const [key, scope] of [['region', 'region'], ['realm', 'realm']]) if (where[key] !== undefined && !ctx.index.ref(where[key]).has(scope)) say(`where.${key}`, `"${String(where[key])}" is not a ${scope} of this pack.`, 'UNKNOWN_REF');
        return;
    }
    if (!Array.isArray(where) || !where.length || where.length > 200) return say('where', 'where must be a list of places, regions or realms, "where conditions fit", or { "kinds": [...] }.');
    for (const ref of where) {
        const scopes = ctx.index.ref(ref);
        if (!['place', 'region', 'realm'].some(scope => scopes.has(scope))) say('where', `where names "${String(ref)}", which is not a place, region or realm of this pack.`, 'UNKNOWN_REF');
    }
}

function modifiers(map, ctx, field) {
    if (!isObject(map)) return ctx.say(field, `${field} must be { "<condition>@<ref>": "×2" }.`);
    for (const [key, value] of Object.entries(map)) {
        checkEntry(key, ctx, `${field}.${key}`, ['anchor', 'condition']);
        if (typeof value !== 'string' || !MODIFIER.test(value.trim())) ctx.say(`${field}.${key}`, `"${String(value)}" is not a modifier; write ×N (×2, ×0.5; ×0 blocks), not a percentage.`);
    }
}

function outcomes(list, ctx) {
    if (!Array.isArray(list) || list.length > WORLD_LIMITS.outcomes) return ctx.say('outcomes', `outcomes must be a list of at most ${WORLD_LIMITS.outcomes} variants.`);
    const names = new Set();
    list.forEach((outcome, n) => {
        const at = `outcomes[${n}]`;
        if (!isObject(outcome)) return ctx.say(at, `${at} must be { "name", "weight", "effects"?, "summary"? }.`);
        for (const key of Object.keys(outcome)) if (!['name', 'weight', 'effects', 'summary'].includes(key)) ctx.say(`${at}.${key}`, `"${key}" is not an outcome field (name, weight, effects, summary).`, 'UNKNOWN_FIELD');
        if (!SENTENCE(outcome.name, 80)) ctx.say(`${at}.name`, `${at}.name must be text of 1 to 80 characters.`);
        else if (names.has(outcome.name)) ctx.say(`${at}.name`, `two outcomes are named "${outcome.name}".`, 'DUPLICATE');
        else names.add(outcome.name);
        const weight = outcome.weight;
        if (typeof weight === 'number') { if (!Number.isFinite(weight) || weight < 0) ctx.say(`${at}.weight`, `${at}.weight is ${weight}; a literal weight must be 0 or more.`); }
        else if (typeof weight === 'string' && /^(power|score):/.test(weight)) {
            const kind = weight.slice(0, weight.indexOf(':'));
            const id = weight.slice(weight.indexOf(':') + 1).trim();
            if (!ctx.index.standing(kind, id)) ctx.say(`${at}.weight`, `${at}.weight "${weight}": there is no ${kind} with that id (or unique name) in this pack.`, 'UNKNOWN_REF');
        } else ctx.say(`${at}.weight`, `${at}.weight must be a number of 0 or more, power:<id> or score:<id>.`);
        if (outcome.effects !== undefined) checkEffects(outcome.effects, ctx, `${at}.effects`, { top: false });
        if (outcome.summary !== undefined && !SENTENCE(outcome.summary, 300)) ctx.say(`${at}.summary`, `${at}.summary must be text of at most 300 characters.`);
    });
}

function endsWhen(value, ctx) {
    if (value === undefined) return ctx.say('ends_when', 'every event needs ends_when: "instant" or { "for": "40 days", "any_of": [...] }.');
    if (value === 'instant') return;
    if (!isObject(value) || (value.for === undefined && value.any_of === undefined)) return ctx.say('ends_when', 'ends_when must be "instant" or an object with "for" (a duration) and/or "any_of" (anchors or thresholds), not a sentence.');
    for (const key of Object.keys(value)) if (key !== 'for' && key !== 'any_of') ctx.say(`ends_when.${key}`, `"${key}" is not an ends_when field (for, any_of).`, 'UNKNOWN_FIELD');
    if (value.for !== undefined && !(durationDays(value.for) > 0)) ctx.say('ends_when.for', `"${String(value.for)}" is not a duration (like "40 days").`);
    if (value.any_of !== undefined) {
        if (!Array.isArray(value.any_of) || !value.any_of.length) ctx.say('ends_when.any_of', 'any_of must be a non-empty list of anchors or thresholds.');
        else value.any_of.forEach((entry, n) => checkEntry(entry, ctx, `ends_when.any_of[${n}]`, ['threshold', 'anchor']));
    }
}

/** Checks one event; returns a plain copy of it, or null (the problems went to `ctx.say`). `ctx.ok()` says whether any came. */
export function checkWorldEvent(record, ctx) {
    const { say } = ctx;
    for (const key of Object.keys(record)) if (!WORLD_EVENT_FIELDS.includes(key)) say(key, `"${key}" is not an event field (expected ${WORLD_EVENT_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (typeof record.id !== 'string' || !SLUG.test(record.id)) say('id', 'id must be lower-case-with-hyphens.');
    const kind = record.kind ?? 'one-off';
    if (!EVENT_KINDS.includes(kind)) say('kind', `kind must be one of ${EVENT_KINDS.join(', ')}.`);
    if (record.certainty !== undefined && !EVENT_CERTAINTY.includes(record.certainty)) say('certainty', `certainty must be one of ${EVENT_CERTAINTY.join(', ')}.`);
    if (record.reach !== undefined && !EVENT_REACH.includes(record.reach)) say('reach', `reach must be one of ${EVENT_REACH.join(', ')}.`);
    if (record.severity !== undefined && record.severity !== 'major' && record.severity !== 'minor') say('severity', 'severity must be "major" or "minor".');
    if (record.title !== undefined && !SENTENCE(record.title, 120)) say('title', 'title must be text of at most 120 characters.');
    if (record.summary !== undefined && !SENTENCE(record.summary, 300)) say('summary', 'summary must be one Journal line of at most 300 characters.');
    whereOf(record, ctx, say, kind);
    for (const field of ['requires', 'requires_any']) {
        if (record[field] === undefined) continue;
        if (!Array.isArray(record[field]) || record[field].length > 200) say(field, `${field} must be a list of at most 200 entries.`);
        else record[field].forEach((entry, n) => {
            checkEntry(entry, ctx, `${field}[${n}]`);
            if (entry === `stage:${record.id}`) say(`${field}[${n}]`, 'an event cannot require its own stage.');
        });
    }
    const stages = [...(record.requires ?? []), ...(record.requires_any ?? [])].filter(entry => typeof entry === 'string' && entry.startsWith('stage:'));
    if (kind === 'chain-stage' && !stages.length) say('requires', 'a chain stage requires "stage:<previous event id>" (in requires, or among the paths of requires_any).');
    if (record.window !== undefined) {
        if (kind === 'recurring') say('window', 'a recurring event has no window; it is rolled again and again (use cooldown and a per-season chance).');
        else if (!isObject(record.window) || Object.keys(record.window).some(key => key !== 'after' && key !== 'within')) say('window', 'window must be { "after"?: <anchor> [+ duration], "within": <duration> }.');
        else {
            if (!(durationDays(record.window.within) > 0)) say('window.within', `"${String(record.window.within)}" is not a duration (like "40 days").`);
            if (record.window.after !== undefined) checkAnchorText(record.window.after, ctx, 'window.after');
        }
    }
    const chance = record.chance === undefined ? null : CHANCE.exec(String(record.chance).trim());
    if (record.chance !== undefined && (!chance || Number(chance[1]) > 100)) say('chance', 'chance must read "20% over the window" or "30% per season" (0 to 100%).');
    else if (chance && (chance[2] === 'per season') !== (kind === 'recurring')) say('chance', kind === 'recurring' ? 'a recurring event\'s chance is per season ("30% per season").' : '"per season" is for a recurring event; write "over the window".');
    if (record.cooldown !== undefined && !(durationDays(String(record.cooldown).replace(/ per place$/, '')) > 0)) say('cooldown', `"${String(record.cooldown)}" is not a duration, such as "1 season per place".`);
    if (kind === 'recurring' && record.cooldown === undefined) say('cooldown', 'a recurring event needs a cooldown such as "1 season per place".');
    for (const field of ['likelier_if', 'less_if']) if (record[field] !== undefined) modifiers(record[field], ctx, field);
    if (record.pre_empted_by !== undefined) {
        if (!Array.isArray(record.pre_empted_by)) say('pre_empted_by', 'pre_empted_by must be a list of anchors.');
        else record.pre_empted_by.forEach((entry, n) => checkEntry(entry, ctx, `pre_empted_by[${n}]`, ['anchor']));
    }
    if (record.anchor_mode !== undefined && record.anchor_mode !== 'first' && record.anchor_mode !== 'each') say('anchor_mode', 'anchor_mode must be "first" or "each".');
    if (record.outcomes !== undefined) outcomes(record.outcomes, ctx);
    if (record.effects !== undefined) checkEffects(record.effects, ctx, 'effects');
    endsWhen(record.ends_when, ctx);
    return JSON.parse(JSON.stringify(record));
}
