// Small DOM helpers shared by the card and the displays.
//
// Everything model- or user-written goes through textContent or text nodes. innerHTML
// is never used here: block names, labels and states are all reader/model text.
// Public face: re-exports its parts.

export { el, button, normalizeTabs, stop } from './dom-parts/elements.js';
export { plural, noun, unitWord, blockName } from './dom-parts/words.js';
export { renderFrame, renderNotices, emptyText, renderEmpty } from './dom-parts/frame.js';
export { renderChanges, changeDot } from './dom-parts/changes.js';
