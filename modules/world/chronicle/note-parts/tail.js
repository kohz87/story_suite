// Story Director v2, chronicle note: builds the [World] tail lines for the next reply.

import { isOpen } from '../domain.js';
import { nearness, scenePlaceOf, tailPick } from '../pick.js';
import { agoText, nowFrom } from '../queries.js';
import { TAIL_BUDGET } from './static-prompt.js';
import { worldEventsOn } from '../../world/news-switch.js';

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
    const chronicle = view?.state?.domains?.chronicle;
    if (!chronicle || !Object.values(chronicle.events ?? {}).some(isOpen)) return { lines: [], optional: [] };
    const query = queryOf(view);
    const near = nearness(query, scenePlaceOf(query, view.state));
    const at = Number.isSafeInteger(view?.chat?.length) ? view.chat.length : null;
    const rev = Number.isSafeInteger(view?.state?.meta?.rev) ? view.state.meta.rev : 0;
    // With the world-events switch on, only entries whose news has reached the scene's place (world.heardHere); the pick itself is as it was.
    let heard = null;
    if (worldEventsOn(view)) {
        try { heard = queryOf(view)?.('world.heardHere', {}) ?? null; } catch { heard = null; }
    }
    const reached = Array.isArray(heard) ? new Set(heard.map(event => event.id)) : null;
    const ids = tailPick(chronicle, { at, rev, near }).filter(id => !reached || reached.has(id));
    const now = nowFrom(query, view.state);
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
