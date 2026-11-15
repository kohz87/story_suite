// The data modules' prompt tail and reply cards (moved out of data-modules/part.js unchanged):
// compact field words, one summary line per block, their tail room, and the cards under the head reply.
// Public face: re-exports its parts.
export { valueText, entriesText, barText, shownText } from './prompt-parts/field-words.js';
export { fieldText, fieldsText, namedChanges } from './prompt-parts/field-lines.js';
export { tailRoom } from './prompt-parts/tail-room.js';
export { summaryOf, tailLines } from './prompt-parts/summary.js';
export { CARD_SLOTS, blockCards, blockCardSlots } from './prompt-parts/cards.js';
