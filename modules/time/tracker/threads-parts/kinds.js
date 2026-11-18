// The thread kinds the feature owns, asking about one, and leaving them out of a director slice.

/**
 * The kind of a thread that mirrors an Active world event (world-events switch, spec §9; seam audit E32: `event` is taken). Not a
 * capture kind (no line writes it), not one of the threads feature's owned kinds (the world-events switch carries it), and in none of
 * the kind lists that pick initiative, offers, lapses or News, so a mirror is none of those.
 */
export const WORLD_EVENT_KIND = 'world-event';

/** The thread kinds the feature owns (the Director's own: quests and hooks are not). */
export const THREAD_KINDS_OWNED = Object.freeze(['agenda', 'event', 'clock', 'beat', 'secret']);
const OWNED = new Set(THREAD_KINDS_OWNED);

/** Whether `kind` is one the feature owns. */
export const ownedKind = kind => OWNED.has(kind);

/** A director slice (`{ threads, … }`) with the owned kinds' threads left out; nothing is written back. */
export function withoutOwnedThreads(director) {
    const threads = director?.threads;
    if (!threads || typeof threads !== 'object') return director;
    return { ...director, threads: Object.fromEntries(Object.entries(threads).filter(([, thread]) => !OWNED.has(thread?.kind))) };
}
