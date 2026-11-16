// Scrolls a sideways nav list so the chosen item is in view.

import { zoomOf } from '../../scroll.js';

/** Brings `item` into view inside the sideways-scrolling `list`, if it is not already (no page scrolling). */
export function revealItem(list, item, smooth = false) {
    const box = list?.getBoundingClientRect?.();
    const rect = item?.getBoundingClientRect?.();
    if (!box || !rect || !(box.width > 0) || !(rect.width > 0)) return false;
    if (rect.left >= box.left && rect.right <= box.right) return false;
    // measured in drawn pixels; the list scrolls in its own (a zoomed root, size.css)
    const delta = ((rect.left - box.left) - (box.width - rect.width) / 2) / zoomOf(list);
    const reduced = list.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    if (typeof list.scrollBy === 'function') list.scrollBy({ left: delta, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    else list.scrollLeft = (list.scrollLeft ?? 0) + delta;
    return true;
}
