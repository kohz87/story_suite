// Story Director v2, tracker part (domain): the step trail's size limits, key rule and order, shared by its writer and its validator.

/** Entries the writer keeps (capture-parts/step-trail.js), the oldest going first. */
export const STEP_KEPT = 400;

/**
 * The most the validator lets the map hold. Replay can hold more than the live cap: a Re-read of an edited
 * reply may add more entries than it did the first time, while a later reply's stored prune of a key that is
 * gone is skipped and its adds still go in (the same headroom as the problems list).
 */
export const STEP_CEILING = 2 * STEP_KEPT;

/** A step's key: the reply that wrote it (its carrier sid, or `r<rev>` with no sid) and a number within that reply. */
export const STEP_KEY = /^([A-Za-z0-9_-]{1,80})\.(\d+)$/;

/**
 * The map's keys in story order. By the writing reply's turn (`turn`, `director.turn.n`) first: stored values never move, so a
 * middle delete keeps them in order. Within a turn, a reply's own steps go by their number; two replies share a turn only when a
 * Re-read gives Director lines to a reply that had none (its turn is then the next reply's), and there the one placed earlier in
 * the chat (`place`, the carrier index when written: a later reply's stored place is never below the Re-read one's) goes first.
 */
export function stepOrder(map) {
    const int = value => (Number.isSafeInteger(value) ? value : -1);
    const at = key => {
        const match = STEP_KEY.exec(key);
        return { key, reply: match ? match[1] : key, n: match ? Number(match[2]) : -1, turn: int(map[key]?.turn), place: int(map[key]?.place) };
    };
    return Object.keys(map).map(at).sort((a, b) => a.turn - b.turn
        || (a.reply === b.reply ? a.n - b.n : a.place - b.place)
        || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(entry => entry.key);
}
