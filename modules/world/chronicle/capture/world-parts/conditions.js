// Story Director v2, chronicle part: the `conditions:` label of a `world` line and the one-world-line-per-reply rule (switch `story-director.world-events`).
// Conditions are set and lifted only through the commands `chronicle.condition.set` and `chronicle.condition.clear` (by 'narrator').

import { cleanName, keyOf } from '../../domain.js';
import { asText } from '../text.js';
import { conditionTarget } from './condition-check.js';

const MAX_TOKENS = 6;
const MAX_CLAIMS = 32;
const SPLIT = /\s*[,;]\s*/;

/**
 * A `conditions:` label (`+gate-closed, -plague, +roads-closed@Ledgerford-Northledger`): `[{ name, clear, ref? }]`, at most MAX_TOKENS;
 * a name with no sign sets; `name@ref` names the ref itself (a route, or a ref other than the line's place, seam audit E38).
 */
export function readConditions(value) {
    const out = [];
    for (const token of asText(value).split(SPLIT)) {
        const clear = /^[-−–]\s*/.test(token.trim());
        const [head, ...rest] = token.trim().replace(/^[+\-−–]\s*/, '').split('@');
        const name = cleanName(head);
        const ref = cleanName(rest.join('@'));
        if (!keyOf(name) || out.some(item => keyOf(item.name) === keyOf(name) && item.clear === clear && keyOf(item.ref ?? '') === keyOf(ref))) continue;
        out.push({ name, clear, ...(keyOf(ref) ? { ref } : {}) });
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
 * Sets and lifts `items` ([{ name, clear, ref? }]). `place` / `region` / `realm` is where the line says it holds; each condition takes the
 * ref of its declared scope (condition-check.js). Returns { done: ['+gate (X)'], notes: ['...refused...'] }.
 */
export function applyConditions(ctx, items, { place, region, realm = '', why }) {
    const done = [];
    const notes = [];
    let declared;
    try { declared = ctx.query('chronicle.conditionNames', {}); } catch { declared = null; }
    for (const { name, clear, ref: explicit = '' } of items) {
        const known = Array.isArray(declared) ? declared.find(entry => keyOf(entry?.name) === keyOf(name)) : null;
        if (!known) { notes.push(`"${name}" is not a condition the world lists`); continue; }
        // Asked first (condition-check.js): a refused sub-command would fail the whole line on the host.
        const { ref, refusal } = conditionTarget(ctx, known, { place, region, realm, explicit }, clear);
        if (refusal) { notes.push(refusal); continue; }
        const failed = clear
            ? attempt(ctx, 'chronicle.condition.clear', { name: known.name, ref, why, by: 'narrator' })
            : attempt(ctx, 'chronicle.condition.set', { name: known.name, scope: known.scope, ref, why, by: 'narrator' });
        if (failed) notes.push(`"${known.name}": ${failed}`);
        else done.push(`${clear ? '-' : '+'}${known.name} (${ref})`);
    }
    return { done, notes };
}
