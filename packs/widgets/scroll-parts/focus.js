// Measuring a node's CSS zoom and focusing it without scrolling the page.

/**
 * The CSS zoom `node` is drawn at, its ancestors' included: the browser's `currentCSSZoom` where it has one, else its drawn width
 * over its own; 1 when there is nothing to measure (no layout, the tests' fake DOM).
 */
export function zoomOf(node) {
    const own = Number(node?.currentCSSZoom);
    if (Number.isFinite(own) && own > 0) return own;
    const width = Number(node?.offsetWidth);
    const drawn = Number(node?.getBoundingClientRect?.()?.width);
    return width > 0 && drawn > 0 ? drawn / width : 1;
}

/** Focuses `node` and never scrolls the page for it. → whether there was a node. */
export function focusNode(node) {
    if (!node || typeof node.focus !== 'function') return Boolean(node);
    try { node.focus({ preventScroll: true }); } catch { try { node.focus(); } catch { /* not focusable */ } }
    return true;
}
