// Shared DOM helpers for the standard widgets (SPEC §13.5).
//
// Every widget builds its DOM with createElement / createElementNS and textContent: names, labels and
// numbers come from story data (and so, at one remove, from the model), so none of it is ever parsed as
// markup. Styling goes through `ss-w-` classes, `data-*` attributes and CSS custom properties only, so a
// screen's CSS can restyle any widget.
// Public face: re-exports its parts.

export { docOf, h, button, setData } from './dom-parts/elements.js';
export { SVG_NS, s } from './dom-parts/svg.js';
export { TONES, toneOf, setTone } from './dom-parts/tones.js';
export { clamp, num, fmt } from './dom-parts/numbers.js';
export { BAR_STEPS, barStep } from './dom-parts/bar-steps.js';
export { text, str, initials, humanize } from './dom-parts/text.js';
export { safeImageUrl, faClasses } from './dom-parts/images.js';
export { DEFAULT_FA_ICON, iconNode } from './dom-parts/icon-node.js';
export { runCommand, ensureStyles, shell } from './dom-parts/shell.js';
