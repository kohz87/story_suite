// ss.tabs and ss.navbar (view/glass-*.css): the two ways Story Suite's screens move between sections.
//
// * ss.tabs: a row of text tabs (an icon when the item has one), for a panel or a screen's own sections.
// * ss.navbar: the bottom bar of the game view: an icon over a label, in a dense glass pill.
//
// Both are navigation, not ARIA tabs: a `<nav>` of buttons, the current one `aria-current="page"`, a
// roving tabindex (one Tab stop; the arrow keys, Home and End move the focus along the row, Enter or Space
// chooses, as any button). With `onSelect` a choice runs that command with `{ tabs: <id> }` / `{ navbar: <id> }`
// (a screen change, never a story action, F95/F96); the choice also shows at once (a screen that redraws with
// another `current` wins). A row wider than its box scrolls sideways, and the current item is brought into view
// (on a phone, five or more sections do not fit).
//
// Built with createElement and textContent only, like every standard widget (dom.js).
//
// Public face: re-exports its parts.

export { NAV_MAX_ITEMS } from './nav-parts/shared-limits.js';
export { navItems } from './nav-parts/items.js';
export { revealItem } from './nav-parts/reveal.js';
export { tabs, navbar, renderTabStrip } from './nav-parts/widget.js';
