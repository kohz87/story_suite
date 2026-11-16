// The inventory domain's prompt view (moved out of domains/inventory.js unchanged; inventory.js re-exports every public name): how a
// story note, an item and a group of items read in the tail, packed into a line that fits, and the tail itself. Pure.
// Public face: re-exports its parts.

export { condText, promptNote, itemPhrase, owners } from './prompt-parts/phrases.js';
export { pack } from './prompt-parts/packing.js';
export { WALLET_NOTE, inventoryTail } from './prompt-parts/tail.js';
