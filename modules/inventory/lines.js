// The inventory domain's story-line helpers that the loot offer and the reader's takes share with the story capture (moved out of
// domains/inventory.js unchanged): the reply's money tally, the quantity a line gives, and the carry limit.
// Public face: re-exports its parts.

export { tallied, storedTally, clicksOf, storyCoin } from './lines-parts/tally.js';
export { storyItems, lineQty } from './lines-parts/quantity.js';
export { carryFits, readerCarry } from './lines-parts/carry.js';
