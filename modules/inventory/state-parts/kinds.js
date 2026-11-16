// The inventory item kinds, rarities, the story's kind words and the order kinds are listed in.

export const KINDS = Object.freeze(['goods', 'material', 'consumable', 'equipment', 'quest', 'money']);
export const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);
// The order kinds are listed in (prompt view and tab): what the story turns on first.
/** The words of a story line's `kind:` that name an inventory kind. */
export const STORY_KIND = Object.freeze({ consumable: 'consumable', potion: 'consumable', draught: 'consumable', elixir: 'consumable', food: 'consumable', drink: 'consumable', material: 'material', ingredient: 'material', quest: 'quest' });
export const KIND_ORDER = Object.freeze(['quest', 'equipment', 'consumable', 'material', 'goods', 'money']);
