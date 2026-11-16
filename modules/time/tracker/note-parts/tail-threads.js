// Story Director v2, tracker part (note): picks the threads the tail reads (ended ones briefly, idle ones dropped).

import { IDLE_REPLIES } from './budgets.js';

// Ended threads are read for this many replies after (v1's "resolved recently", relevance.js).
const ENDED_REPLIES = 5;
const DATED = ['due', 'on', 'arrive'];

const lastTurn = thread => Math.max(...['created', 'changed', 'seen', 'closed', 'engaged']
    .map(name => thread.track?.[name]?.turn).filter(Number.isSafeInteger), -Infinity);

/**
 * The threads the tail reads (B-b1r2-8): ended ones only for ENDED_REPLIES replies, open ones until they
 * have been idle for IDLE_REPLIES (see there). However long the chat, the tail works on the live ones.
 */
export function tailThreads(director, { said = '', place = '' } = {}) {
    const threads = director.threads ?? {};
    const n = Number.isSafeInteger(director.turn?.n) ? director.turn.n : 0;
    const words = `${said}\n${place}`.toLowerCase();
    const keep = thread => {
        const last = lastTurn(thread);
        // A thread with no reply count (made outside a reply's lines) is read as before.
        if (last === -Infinity) return true;
        if (thread.status !== 'active') return n - last < ENDED_REPLIES;
        if (n - last < IDLE_REPLIES || thread.kind === 'secret' || thread.taken || thread.track?.pinned) return true;
        if ((thread.kind === 'quest' && !thread.offer) || DATED.some(name => String(thread.fields?.[name] ?? '').trim())) return true;
        const key = String(thread.key ?? '').toLowerCase();
        return Boolean(key) && words.includes(key);
    };
    if (Object.values(threads).every(keep)) return director;
    return { ...director, threads: Object.fromEntries(Object.entries(threads).filter(([, thread]) => keep(thread))) };
}
