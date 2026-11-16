// Asking whether a scroller is at its bottom: the gap below, the slack allowed and the answer.

/** How far (in drawn pixels) the bottom of `scroller`'s content is below what it shows, or null where there is no layout to ask. */
export function gapBelow(scroller) {
    const gap = Number(scroller?.scrollHeight) - Number(scroller?.scrollTop) - Number(scroller?.clientHeight);
    return Number.isFinite(gap) && Number(scroller?.clientHeight) > 0 ? gap : null;
}

/** The most slack "at the bottom" ever allows, in drawn pixels (Story Director's follow of a new reply used the same 400). */
export const BOTTOM_SLACK = 400;

/**
 * How far from its bottom a reader still counts as being at it: half of what the scroller shows, at most BOTTOM_SLACK. SillyTavern scrolls
 * to a new reply and other extensions still add to it after that (status rows, cards: 100 px or more), so a gap of a line or two would
 * miss a reader who has not moved; a reader who scrolled up to read is further away than half a screen.
 */
export function bottomSlack(scroller) {
    const shown = Number(scroller?.clientHeight);
    return Number.isFinite(shown) && shown > 0 ? Math.min(BOTTOM_SLACK, Math.round(shown / 2)) : 0;
}

/** Whether `scroller` is scrolled to (within `slack` pixels, by default bottomSlack) of its bottom. False where there is no layout. */
export function atBottom(scroller, slack = bottomSlack(scroller)) {
    const gap = gapBelow(scroller);
    return gap !== null && gap <= slack;
}
