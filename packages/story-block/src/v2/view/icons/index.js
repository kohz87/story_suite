// The extension's own icons (UI stage, step 7): the inline SVG builder for the `ph-*` set (view/icons/set.js, Phosphor)
// and the default icon of each game view screen and tab. Built with createElementNS only (no HTML parsing).
// An id names the line weight (`ph-house`); `ph-house:fill` names the solid one (the current tab).
// Public face: re-exports its parts.

export { TAB_ICONS, tabIcon, iconFor } from './index-parts/tab-icons.js';
export { hasIcon, svgIcon } from './index-parts/svg.js';
