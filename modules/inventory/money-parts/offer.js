// The currency a game offers a chat: the chat's frame, else the selected game's.

/**
 * The currency a game offers a chat when the reader has named none: the chat's frame when it has one (`frame.set`; the currency its game had when the chat
 * began, null for the built-in game, so a game swapped later does not move it), else `live` (the selected game's, null for none). null: the built-in gold.
 */
export const currencyOffer = (frame, live = null) => (frame?.set === true ? frame.currency ?? null : live ?? null);
