// Revealing a node inside the page scroller and focusing it, moving nothing else.

import { zoomOf, focusNode } from './focus.js';

/** The page scroller a node is in (the settings window's `.ss-settings-content`), or null. */
export function scrollerOf(node) {
    return node?.closest?.('.ss-settings-content') ?? null;
}

// The height the page's own heading strip covers at the top of the scroller (a sticky strip from 760px), 0 when there is none.
function coveredTop(scroller, box) {
    const view = scroller.ownerDocument?.defaultView;
    // a document that cannot answer the selector (a test's fake DOM) has no heading strip: nothing is covered
    let head = null;
    try { head = scroller.querySelector?.('.ss-settings-page-head:not([hidden])') ?? null; } catch { head = null; }
    if (!head || typeof head.getBoundingClientRect !== 'function' || typeof view?.getComputedStyle !== 'function') return 0;
    if (view.getComputedStyle(head).position !== 'sticky') return 0;
    const rect = head.getBoundingClientRect();
    return Math.max(0, rect.bottom - box.top);
}

/**
 * Scrolls `scroller` (not its ancestors) so `node` shows: `block` 'start' puts it near the top (under the sticky heading
 * strip), 'center' in the middle, 'nearest' only as far as needed. `scroller` may be null: the node's page scroller. → whether it moved.
 */
export function revealIn(scroller, node, block = 'start') {
    const box = scroller ?? scrollerOf(node);
    if (!box || !node || typeof box.getBoundingClientRect !== 'function' || typeof node.getBoundingClientRect !== 'function') return false;
    const outer = box.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    if (!(outer.height > 0)) return false;
    const covered = coveredTop(box, outer);
    const margin = 8;
    let delta = 0;
    if (block === 'center') delta = (rect.top + rect.height / 2) - (outer.top + covered + (outer.height - covered) / 2);
    else if (block === 'nearest') {
        if (rect.top < outer.top + covered + margin) delta = rect.top - (outer.top + covered + margin);
        else if (rect.bottom > outer.bottom - margin) delta = Math.min(rect.bottom - (outer.bottom - margin), rect.top - (outer.top + covered + margin));
    } else delta = rect.top - (outer.top + covered + margin);
    if (!delta) return false;
    const before = box.scrollTop;
    box.scrollTop = before + delta / zoomOf(box);
    return box.scrollTop !== before;
}

/** Reveals a node and takes the focus to it, moving nothing but the page scroller. */
export function showAndFocus(node, block = 'start') {
    if (!node) return false;
    revealIn(null, node, block);
    return focusNode(node);
}
