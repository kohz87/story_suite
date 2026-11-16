// The inventory domain's story capture (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): the
// `- item` / `+ item` / `~ item` lines, the `+ coin` / `- coin` lines, a used consumable, and the money a line pays or receives.
// Public face: re-exports its parts.

export { USED_WORDS, GONE_WORDS, usedByLine } from './story-parts/used.js';
export { captureItem } from './story-parts/item.js';
export { receiveStory, captureCoin } from './story-parts/coin.js';
