// The core module's id, budget and the static prompt and grammar text. No domain logic.

export const CORE_MODULE_ID = 'story-block';
export const CORE_BUDGET = 400;

// One line for the static prompt part: no names, counts or coins, so it is byte-identical every reply.
// (The coin rule is said once, in the coin kind's grammar line; the wallet line and this one do not repeat it.)
export const CORE_STATIC = 'Code keeps the inventory, the wallet, the place and who is present: use or pay only what the '
    + 'lists below hold, and write a change line for every item gained, used or lost and every arrival, departure or move.';

/** Added to the `+ item` grammar line while `story-block.gear` is on (and only then): the gear words, short, static. */
export const GEAR_ITEM_GRAMMAR = '; gear: kind: weapon|armour|shield|head|cloak|feet|accessory|bag | rarity: common|uncommon|rare|epic|legendary | DEX: +1 (at most 2 stats, held to rarity) | equipped: slot; ~ item Name | wear: scuff|tear|ruin | repair: mend|restore';
