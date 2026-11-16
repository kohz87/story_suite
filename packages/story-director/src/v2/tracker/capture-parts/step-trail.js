// Story Director v2, tracker part (capture): the steps a quest has been through, kept on the director as `steps`.
//
// `director.steps` is `{ "<reply>.<n>": { thread, text, turn, place } }`: each step is one add under a key of its own, the reply's carrier
// sid and a number (Story Block's rule 2: per-reply bookkeeping is keyed by carrier sid), so a swipe, a middle delete or a Re-read
// only takes away what its reply wrote, and an edited Re-read never lands on a key a later reply's stored add uses. `turn` and
// `place` are the writing reply's turn (`director.turn.n`) and chat index: a trail is read in that order (`stepsFor`, shared-step-keys.js
// stepOrder), not in key order. A thread's first step is written by the reply that makes it (a told quest or hook, or an offer),
// so deleting a later reply never takes it away.

import { turnNumber } from '../domain-parts/turn.js';
import { STEP_KEPT, STEP_KEY, stepOrder } from '../domain-parts/shared-step-keys.js';

/** Most steps a trail shows (the newest). */
export const STEP_ROOM = 12;
/** Longest step text kept, in characters (the validator's limit). */
const STEP_CHARS = 600;

export const clipStep = value => Array.from(String(value ?? '').trim()).slice(0, STEP_CHARS).join('');
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// The reply a story line comes from (its carrier sid); a write outside a reply's capture (an arc plan, a click) is keyed by its rev.
function replyKey(ctx) {
    const sid = ctx?.carrier?.sid;
    if (ctx?.cause === 'story' && typeof sid === 'string' && STEP_KEY.test(`${sid}.0`)) return sid;
    return `r${Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0}`;
}

/** The steps of thread `id` in the order they were written, a repeat of the one before left out, at most STEP_ROOM. */
export function stepsFor(director, id) {
    const map = isRecord(director?.steps) ? director.steps : {};
    const out = [];
    for (const key of stepOrder(map)) {
        const entry = map[key];
        if (isRecord(entry) && entry.thread === id && typeof entry.text === 'string' && entry.text && out.at(-1) !== entry.text) out.push(entry.text);
    }
    return out.slice(-STEP_ROOM);
}

/** Notes the step thread `thread` has now (a draft), when it differs from the last in its trail. */
export function recordStep(director, ctx, thread) {
    const now = clipStep(thread?.fields?.step);
    if (!now || stepsFor(director, thread.id).at(-1) === now) return;
    // An older state has no map: made once here (the whole map is written then).
    if (!isRecord(director.steps)) director.steps = {};
    const reply = replyKey(ctx);
    let n = 0;
    // A Continue keeps its reply's sid: its steps go on after the ones the reply wrote before.
    while (Object.hasOwn(director.steps, `${reply}.${n}`)) n += 1;
    const place = Number.isSafeInteger(ctx?.carrier?.index) && ctx.carrier.index >= 0 ? ctx.carrier.index : -1;
    director.steps[`${reply}.${n}`] = { thread: thread.id, text: now, turn: turnNumber(director), place };
    const keys = stepOrder(director.steps);
    if (keys.length > STEP_KEPT) for (const key of keys.slice(0, keys.length - STEP_KEPT)) delete director.steps[key];
}
