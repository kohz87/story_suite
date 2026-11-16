// How many things an offer holds, how many offers a reply keeps and how long where-text may be.

// `? loot Rusty Key, Lantern Oil x2, Torn Map — on the cellar shelf | qty: 1`: what lies there, offered
// on the reply's card as chips; the reader takes the ones they want (inventory.lootTake). The offer is
// read as a `+ item` line would be, so the chips show what can be taken; things the party already carries (tolerant
// names) are left out. One offer per reply, keyed by the reply's record ID (`loot[<sid>]`, scratch like
// perReply); a second loot line in the reply adds to it. A reply keeps the LOOT_KEEP newest offers.
export const LOOT_ITEMS = 8;
export const LOOT_KEEP = 5;

export const MAX_WHERE = 120;
