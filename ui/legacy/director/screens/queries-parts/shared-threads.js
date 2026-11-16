// Story Director v2, part screens: reading the Director's threads through a query (else from the state) and telling open ones and offers apart.

import { ask } from './shared-ask.js';
import { isRecord } from './shared-words.js';

/** Threads as `director.threads` gives them (tracker order), else read from the state. */
export function threadsOf(state, query, args = {}) {
    const listed = ask(query, 'director.threads', args, null);
    if (Array.isArray(listed)) return listed;
    const director = state?.domains?.director;
    const { kind = null, status = null } = args;
    return Object.values(isRecord(director?.threads) ? director.threads : {})
        .filter(thread => isRecord(thread) && (!kind || thread.kind === kind) && (!status || thread.status === status))
        .sort((a, b) => (a.track?.order ?? 0) - (b.track?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export const isOpen = thread => thread.status === 'active' && !thread.ended;
export const isOffer = thread => isOpen(thread) && Boolean(thread.offer) && !thread.taken;
