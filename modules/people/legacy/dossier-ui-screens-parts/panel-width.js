/* NPC State Delta dossier screens part: the dossier's own width: measuring its panel, the narrow switch and the observed width. */
import { TWO_PANE_MIN } from './pane-switch-lines.js';

// The dossier's width in CSS px: its panel when it is shown, else the window (nothing is drawn while it is hidden anyway).
export function panelWidth(panel, win = globalThis) {
    if (!panel || !(panel.clientWidth > 0)) return win?.innerWidth || 0;
    // The container the CSS queries see is the panel's content box, in fractional px (clientWidth rounds, and a zoomed host gives fractional borders).
    const style = typeof win?.getComputedStyle === 'function' ? win.getComputedStyle(panel) : null;
    const px = value => parseFloat(value) || 0;
    const box = style && style.boxSizing === 'border-box' ? px(style.width) - px(style.borderLeftWidth) - px(style.borderRightWidth) - px(style.paddingLeft) - px(style.paddingRight) : 0;
    return box > 0 ? box : panel.clientWidth;
}

// One column (the narrow layout) while the dossier is narrower than two panes need.
export function isNarrowWidth(width) {
    return width > 0 && width < TWO_PANE_MIN; // an unknown width (nothing measured yet) draws the two-pane layout
}
export function isNarrow(panel, win = globalThis) {
    return isNarrowWidth(panelWidth(panel, win));
}

// The width a ResizeObserver entry reports: the panel's content box, the very box the CSS @container lines measure, so the redraw
// and the stylesheet agree on the same frame. Falls back to measuring the panel for a host without contentBoxSize.
export function observedWidth(entry, panel, win = globalThis) {
    const box = Array.isArray(entry?.contentBoxSize) ? entry.contentBoxSize[0] : entry?.contentBoxSize;
    return box && box.inlineSize > 0 ? box.inlineSize : panelWidth(panel, win);
}
