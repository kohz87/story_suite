// Taking a growing list to its bottom again only when the reader was at the bottom before.

import { atBottom, bottomSlack } from './bottom-state.js';

/** Takes `scroller` (not its ancestors) to its bottom. → whether it moved. */
export function scrollToBottom(scroller) {
    if (!scroller || !(Number(scroller.scrollHeight) > 0)) return false;
    const before = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    return scroller.scrollTop !== before;
}

/**
 * Looks now at whether `scroller` is at its bottom. → `{ wasAtBottom, settle() }`: after its content has grown, `settle()` takes it to the
 * bottom again if (and only if) it was at the bottom when this was called, and returns whether it moved.
 */
export function keepAtBottom(scroller, slack = bottomSlack(scroller)) {
    const wasAtBottom = atBottom(scroller, slack);
    return { wasAtBottom, settle: () => (wasAtBottom ? scrollToBottom(scroller) : false) };
}
