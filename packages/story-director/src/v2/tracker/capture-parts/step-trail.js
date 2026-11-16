// Story Director v2, tracker part (capture): the steps a quest has been through, kept on its thread as `steps`.

/** Most steps kept on a thread (the oldest go first). */
export const STEP_ROOM = 12;
/** Longest step text kept in the trail (the validator's limit). */
export const STEP_CHARS = 600;

/**
 * Brings `thread.steps` (the step texts in the order the story wrote them, the current one last) up to the thread's `fields.step`.
 * `before` is the step the thread had when the line began. Written only when it changed; a cleared step leaves the trail as it was.
 */
export function trailStep(thread, before = '') {
    const now = String(thread?.fields?.step ?? '').trim().slice(0, STEP_CHARS);
    if (!now) return;
    const was = Array.isArray(thread.steps) ? thread.steps : (before ? [before] : []);
    if (was.at(-1) === now) {
        if (thread.steps === undefined) thread.steps = was;
        return;
    }
    thread.steps = [...was, now].slice(-STEP_ROOM);
}
