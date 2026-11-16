// The fill-in of a new person (NSD6): after the reply, one backfill per person a stub made (not one per reply), one retry, and a visible note when it fails (the existing toast channel; the changes card is another PR's).
// Built here and not wired: the reply writes the full dossier itself until lines mode is live (N7), so extra fill-ins would cost calls and save nothing.
// The calls run after the reply is shown and never before Send. The queue is the existing backfill queue (runtime-scan-backfill.js); these are its rules for this kind of request.
export const FILL_REASON = 'new-person';
// One attempt of the queue. Its one retry is the request layer's own: an answer that is not JSON is asked for once more with the compact correction prompt
// (src/scanner-request-parts/generate.js), so a fill-in is at most two model calls. The queue does not try again on top of that (no stacked retries).
const FILL_ATTEMPTS = 1;

/** How the backfill queue treats a request: { max (attempts), cooldown (wait before a retry), ownsCall (its own model call: the per-reply cap does not hold it back) }. */
export function fillPolicy(request, defaults = { max: 3, cooldown: true }) {
    if (request?.reason === FILL_REASON) return { max: FILL_ATTEMPTS, cooldown: false, ownsCall: true };
    return { max: defaults.max, cooldown: defaults.cooldown, ownsCall: request?.reason === 'new-admission' };
}

/** The note the reader sees when a fill-in has failed for good (the stub itself stays; Scan dossier asks again by hand). */
export function fillFailureNote(label) {
    return `NPC State: the profile for ${label} could not be filled in. The name, role and look from the story stay; use Scan dossier to try again.`;
}

/** Queues one fill-in for each person a stub made in the reply at `messageId` (`stubs`: [{ id, name }]); `queue` is queueNpcBackfillInState. Returns the state. */
export function queueFills(state, stubs, messageId, queue) {
    for (const { id, name } of Array.isArray(stubs) ? stubs : []) queue(state, id, name, messageId, { reason: FILL_REASON });
    return state;
}
