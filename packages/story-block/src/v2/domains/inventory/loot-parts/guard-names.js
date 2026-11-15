// The names of the loot guards and the owner they are filed under.

// The guards of the loot blocks (Story Block's own, asked through the core module's replayGuard): a take's (lootTakeGuard),
// and the offer's, reply-bound, so it holds while its reply is in the chat (asked, it only checks its own shape).
export const LOOT_GUARD = 'loot.take';
export const LOOT_OFFER = 'loot.offer';
export const LOOT_KINDS = Object.freeze([LOOT_OFFER, LOOT_GUARD]);
export const LOOT_OWNER = 'story-block';
