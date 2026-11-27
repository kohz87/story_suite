// Story Director v2, chronicle note: builds the [World] tail lines for the next reply.

import { isOpen } from '../domain.js';
import { isStaleNews } from '../domain-parts/stale.js';
import { nearness, scenePlaceOf, tailPick } from '../pick.js';
import { agoText, nowFrom } from '../queries.js';
import { TAIL_BUDGET } from './static-prompt.js';

// Characters the lines may take: Story Block estimates tokens as characters / 4.
const MAX_CHARS = TAIL_BUDGET * 4;
const MAX_ITEM = 130;
export const TAIL_HEADER = '[World] Under way off-screen:';

const queryOf = view => (typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);

// One event as a tail line, cut to MAX_ITEM characters.
function itemLine(event, now) {
    const head = `- ${event.name}${event.place ? ` (${event.place})` : ''}`;
    const ago = Number.isSafeInteger(now) && Number.isSafeInteger(event.updated) ? agoText(now - event.updated) : '';
    const tail = ago ? ` Last news ${ago}.` : '';
    let about = event.summary ? `: ${event.summary.replace(/[.!?…]+$/, '')}.` : '.';
    const room = MAX_ITEM - head.length - tail.length;
    if (about.length > room) about = room > 8 ? `${about.slice(0, room - 2).replace(/\s+\S*$/, '')}….` : '.';
    return `${head}${about}${tail}`;
}

/** `context.tail(view)` → `{ lines, optional }` (SPEC §5). */
export function chronicleTail(view) {
    const stored = view?.state?.domains?.chronicle;
    if (!stored) return { lines: [], optional: [] };
    const query = queryOf(view);
    const now = nowFrom(query, view.state);
    // Old news (no word for a long while) is not told as under way; the pick and the state are left as they are.
    const chronicle = { ...stored, events: Object.fromEntries(Object.entries(stored.events ?? {}).filter(([, event]) => !isStaleNews(event, now))) };
    if (!Object.values(chronicle.events).some(isOpen)) return { lines: [], optional: [] };
    const near = nearness(query, scenePlaceOf(query, view.state));
    const at = Number.isSafeInteger(view?.chat?.length) ? view.chat.length : null;
    const rev = Number.isSafeInteger(view?.state?.meta?.rev) ? view.state.meta.rev : 0;
    // With the world-events switch on these lines are not sent: the world note takes their place (index-parts/hooks.js, seam audit E23).
    const ids = tailPick(chronicle, { at, rev, near });
    const lines = [TAIL_HEADER];
    let used = TAIL_HEADER.length;
    for (const id of ids) {
        const line = itemLine(chronicle.events[id], now);
        if (used + 1 + line.length > MAX_CHARS) break;
        lines.push(line);
        used += 1 + line.length;
    }
    return { lines: lines.length > 1 ? lines : [], optional: [] };
}
