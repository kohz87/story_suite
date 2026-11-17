// Story Director v2, chronicle part: the `conditions:` label of a `world` line and the one-world-line-per-reply rule (switch `story-director.world-events`).
// Conditions are set and lifted only through the commands `chronicle.condition.set` and `chronicle.condition.clear` (by 'narrator').

import { cleanName, keyOf } from '../../domain.js';
import { asText } from '../text.js';

const MAX_TOKENS = 6;
const MAX_CLAIMS = 32;
const SPLIT = /\s*[,;]\s*/;

/** A `conditions:` label (`+gate-closed, -plague`): `[{ name, clear }]`, at most MAX_TOKENS; a name with no sign sets. */
export function readConditions(value) {
    const out = [];
    for (const token of asText(value).split(SPLIT)) {
        const clear = /^[-−–]\s*/.test(token.trim());
        const name = cleanName(token.trim().replace(/^[+\-−–]\s*/, ''));
        if (!keyOf(name) || out.some(item => keyOf(item.name) === keyOf(name) && item.clear === clear)) continue;
        out.push({ name, clear });
        if (out.length >= MAX_TOKENS) break;
    }
    return out;
}

/**
 * The one world line a reply may carry: false when this reply (its record ID, `ctx.carrier.sid`) already wrote one, else true, and the
 * reply is marked on the draft `chronicle.worldLine` (scratch: a Re-read starts from the state before the reply and marks it again).
 * A command that is not a reply's capture has no limit.
 */
export function claimReply(ctx, chronicle) {
    const sid = ctx.carrier?.sid;
    if (ctx.cause !== 'story' || typeof sid !== 'string' || !sid) return true;
    if (chronicle.worldLine && Object.hasOwn(chronicle.worldLine, sid)) return false;
    const next = { ...(chronicle.worldLine ?? {}), [sid]: true };
    const keys = Object.keys(next);
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CLAIMS))) delete next[key];
    chronicle.worldLine = next;
    return true;
}

// Runs one command; a refusal (or a missing command) is the words it gave, not a throw.
function attempt(ctx, type, payload) {
    try { ctx.call(type, payload); return ''; } catch (error) { return asText(error?.message) || 'refused'; }
}

/**
 * Sets and lifts `items` ([{ name, clear }]). `place` / `region` is where the line says it holds; a declared scope of region or realm
 * takes the region (else the place), place and route take the place. Returns { done: ['+gate at X'], notes: ['...refused...'] }.
 */
export function applyConditions(ctx, items, { place, region, why }) {
    const done = [];
    const notes = [];
    let declared;
    try { declared = ctx.query('chronicle.conditionNames', {}); } catch { declared = null; }
    for (const { name, clear } of items) {
        const known = Array.isArray(declared) ? declared.find(entry => keyOf(entry?.name) === keyOf(name)) : null;
        if (!known) { notes.push(`"${name}" is not a condition the world lists`); continue; }
        const ref = ['region', 'realm'].includes(known.scope) ? (region || place) : place;
        if (!ref) { notes.push(`"${known.name}" needs a place on the line`); continue; }
        const failed = clear
            ? attempt(ctx, 'chronicle.condition.clear', { name: known.name, ref, why, by: 'narrator' })
            : attempt(ctx, 'chronicle.condition.set', { name: known.name, scope: known.scope, ref, why, by: 'narrator' });
        if (failed) notes.push(`"${known.name}": ${failed}`);
        else done.push(`${clear ? '-' : '+'}${known.name} (${ref})`);
    }
    return { done, notes };
}
