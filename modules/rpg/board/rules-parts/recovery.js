// What a consumable restores (pool and blocks) and how a bar takes it.
// ---- consumables (owner 14 Nov): one rule for the inventory's Use on…, the story's `used: yes` and the fight board ----------------------------------------
// A consumable (inventory kind `consumable`) gives back blocks of one pool: Mana for mana/ether/arcane/focus words, Stamina for stamina/tonic/ration/food/
// drink/bread/tea/ale words, else Health; a tag `restores:mana|stamina|health` decides instead. The amount is by rarity, capped at the pool's size.
// Checked in this order, so "Mana tea" is Mana. A legendary item gives what an epic does; an item with no rarity gives what a common one does.
const MANA_WORDS = /\b(?:mana|ether|arcane|focus)\b/iu;
const STAMINA_WORDS = /\b(?:stamina|tonic|rations?|food|drinks?|bread|tea|ale)\b/iu;
export const RECOVERY_BLOCKS = Object.freeze({ common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 5 });
export const RECOVERY_POOLS = Object.freeze(['health', 'mana', 'stamina']);

/** What a consumable restores: { pool: 'health' | 'mana' | 'stamina', blocks } from its name, rarity and tags (the item as `listItems` gives it, or its def). */
export function recoveryOf(item) {
    const tagged = (Array.isArray(item?.tags) ? item.tags : []).map(tag => /^restores:(health|mana|stamina)$/iu.exec(String(tag).trim())?.[1]?.toLowerCase()).find(Boolean);
    const name = String(item?.name ?? '');
    const pool = tagged ?? (MANA_WORDS.test(name) ? 'mana' : STAMINA_WORDS.test(name) ? 'stamina' : 'health');
    return { pool, blocks: RECOVERY_BLOCKS[item?.rarity] ?? RECOVERY_BLOCKS.common };
}

/**
 * Restores `character`'s pool on `bar` (the roster bar of that pool, `{ value, size }`): up to `blocks`, never past its size, never below what it is.
 * → { pool, from, to, size, gained } (gained 0 when the pool was full, or the character has no such bar).
 */
export function recoverBar(bar, pool, blocks) {
    if (!bar || !Number.isFinite(bar.size) || bar.size <= 0) return { pool, from: 0, to: 0, size: 0, gained: 0 };
    const from = Math.max(0, Math.min(bar.size, bar.value)), to = Math.min(bar.size, from + blocks);
    return { pool, from, to, size: bar.size, gained: to - from };
}
