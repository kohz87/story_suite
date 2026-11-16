// "Show all" / "Show less" for a long card (UI stage 5b). A card's list is capped at about two normal cards (`--sb-cap`,
// the list's `data-capped="true"`): it has no scrollbar, it is cut and the rest waits behind the button. The button is a
// text button (`ss-button`, `aria-expanded`, keyboard reachable) and is there only while the list is taller than its cap.
//
// `capToggle(doc, target, labels)` is the one piece of DOM; the host widget `story-block.show-more` (below) uses it inside a
// template's card (the section that holds it). Its state is in the closure: a redraw of the screen starts folded again.
// Public face: re-exports its parts.

export { SHOW_MORE_WIDGET, CAP_CLASS, QUESTS_LINK_WIDGET, QUESTS_SCREEN } from './show-more-parts/names.js';
export { capToggle } from './show-more-parts/toggle.js';
export { createShowMoreWidget, createQuestsLinkWidget } from './show-more-parts/widgets.js';
