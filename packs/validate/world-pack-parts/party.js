// The job: checking what a pack writes about where the party is: an `in:` / `near:` term and an event's `waits_for`.

import { isObject } from '../core.js';

const knownRegion = (ref, ctx) => ctx.index.ref(ref).has('region');
const ownList = record => Array.isArray(record?.where) && record.where.length > 0;

/** A parsed party term: a region of this pack, or "@region" where a pick binds it (`ctx.placeholders`) or the event has a `where` list (`ctx.whereList`). */
export function checkPartyTerm(parsed, text, ctx, field) {
    if (parsed.own) {
        if (ctx.placeholders || ctx.whereList) return parsed;
        return ctx.say(field, `"${text}": @region is the event's own region; it needs a recurring event, a template or an event with a "where" list.`), null;
    }
    if (!knownRegion(parsed.ref, ctx)) return ctx.say(field, `"${text}": "${parsed.ref}" is not a region of this pack.`, 'UNKNOWN_REF'), null;
    return parsed;
}

/** `waits_for` of a world event `record` (kind `kind`): "near", "in", { "near": [regions] } or { "in": [regions] }, with a window. */
export function checkWaitsFor(record, ctx, kind) {
    const value = record.waits_for;
    if (value === undefined) return;
    const say = (message, code) => ctx.say('waits_for', message, code);
    if (kind === 'recurring') say('a recurring event has no window to wait in; use "requires": ["near:@region"], or a "likelier_if" on it.');
    else if (record.on !== undefined) say('"on" is one fixed day, so there is nothing to wait for; write a "window".');
    else if (record.window === undefined) say('waits_for needs a "window": on its last day the event fires wherever the party is.');
    if (value === 'near' || value === 'in') {
        if (!ownList(record)) say(`"${value}" is read against the event's "where" list, and it has none; add one, or write { "${value}": ["<region id>"] }.`);
        return;
    }
    const keys = isObject(value) ? Object.keys(value) : [];
    if (keys.length !== 1 || (keys[0] !== 'near' && keys[0] !== 'in') || !Array.isArray(value[keys[0]]) || !value[keys[0]].length || value[keys[0]].length > 200) {
        return say('waits_for must be "near", "in", { "near": ["<region id>"] } or { "in": ["<region id>"] }.');
    }
    for (const ref of value[keys[0]]) if (typeof ref !== 'string' || !knownRegion(ref, ctx)) say(`"${String(ref)}" is not a region of this pack.`, 'UNKNOWN_REF');
}
