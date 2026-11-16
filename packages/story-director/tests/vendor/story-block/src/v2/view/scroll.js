// Scrolling and focus inside Story Suite's windows, without moving anything around them (phone hotfix).
//
// `node.scrollIntoView()` and a plain `node.focus()` scroll every scrollable ancestor, and on a phone that includes the
// fixed layer and window around the page (their `overflow: hidden` does not stop a script), the document and the
// browser's visual viewport: the window's header, search and rail were pushed off the top with an empty band below the
// footer. So inside the settings window:
//
// * `revealIn(scroller, node, block)` moves one thing only: the page scroller's `scrollTop`.
// * `focusNode(node)` is `focus({ preventScroll: true })`; the caller reveals the node with `revealIn` when it should be seen.
// * `holdPage(doc)` keeps the document where it was while the window is open (and stops overscroll chaining into it).
// * `followViewport(doc, layer)` (a phone) keeps the window's layer exactly over what is visible: the visual viewport
//   (it shrinks for the on-screen keyboard and can be panned by the browser).
//
// * `gapBelow(scroller)`, `atBottom(scroller)`, `scrollToBottom(scroller)` and `keepAtBottom(scroller)` are for a list that grows at its end
//   (the chat: a card drawn under the newest reply): `keepAtBottom` is asked before the growth and `settle()` after it, and the list
//   is taken to its bottom again only if the reader was at the bottom before; a reader who had scrolled up is never moved.
// * `zoomOf(node)` is the CSS zoom a node is drawn at (Story Suite's roots are zoomed, size.css): measured distances are drawn
//   pixels, `scrollTop` is the scroller's own, so a measured distance is divided by it before it moves a scroller.
//
// Everything tolerates a document with no layout (the tests' fake DOM): nothing is scrolled then, and nothing throws.
// Public face: re-exports its parts.

export { zoomOf, focusNode } from './scroll-parts/focus.js';
export { gapBelow, BOTTOM_SLACK, bottomSlack, atBottom } from './scroll-parts/bottom-state.js';
export { scrollToBottom, keepAtBottom } from './scroll-parts/bottom-keep.js';
export { scrollerOf, revealIn, showAndFocus } from './scroll-parts/reveal.js';
export { holdPage, followViewport } from './scroll-parts/page-hold.js';
