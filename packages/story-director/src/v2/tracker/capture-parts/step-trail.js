// Story Director v2, tracker part (capture): the steps a quest has been through, kept on the director as `steps`.
//
// `director.steps` is `{ "<rev>.<n>": { thread, text } }`: each step is one add under a key of its own (like a problem), so a swipe,
// a middle delete or a Re-read only takes away what its reply wrote. A thread's trail is read from it (`stepsFor`).

import { byKey } from '../domain-parts/shared-problem-keys.js';

/** Most steps a trail shows (the newest). */
export const STEP_ROOM = 12;
/** Longest step text kept, in characters (the validator's limit). */
const STEP_CHARS = 600;
// Entries kept in all, the oldest going first.
const KEPT = 400;

export const clipStep = value => Array.from(String(value ?? '').trim()).slice(0, STEP_CHARS).join('');
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The steps of thread `id` in the order they were written, a repeat of the one before left out, at most STEP_ROOM. */
export function stepsFor(director, id) {
    const map = isRecord(director?.steps) ? director.steps : {};
    const out = [];
    for (const key of Object.keys(map).sort(byKey)) {
        const entry = map[key];
        if (isRecord(entry) && entry.thread === id && typeof entry.text === 'string' && entry.text && out.at(-1) !== entry.text) out.push(entry.text);
    }
    return out.slice(-STEP_ROOM);
}

/**
 * Notes the step thread `thread` has now (a draft), when it differs from the last in its trail. `before` is the step it had when the
 * line began: a thread with no trail yet (made by another path, or by an older chat) first gets that step as its first entry.
 */
export function recordStep(director, ctx, thread, before = '') {
    const now = clipStep(thread?.fields?.step);
    if (!now) return;
    const trail = stepsFor(director, thread.id);
    const first = trail.length ? null : clipStep(before);
    if ((trail.at(-1) ?? first) === now) return;
    // An older state has no map: made once here (the whole map is written then).
    if (!isRecord(director.steps)) director.steps = {};
    const rev = Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0;
    let n = 0;
    for (const text of [first, now]) {
        if (!text || text === trail.at(-1)) continue;
        while (Object.hasOwn(director.steps, `${rev}.${n}`)) n += 1;
        director.steps[`${rev}.${n}`] = { thread: thread.id, text };
    }
    const keys = Object.keys(director.steps);
    if (keys.length > KEPT) for (const key of keys.sort(byKey).slice(0, keys.length - KEPT)) delete director.steps[key];
}
