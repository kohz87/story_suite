// Item kinds, rarities, field names and the stat-name pattern.

// Item definitions follow Story Block's inventory def (SPEC §7).
export const ITEM_KINDS = Object.freeze(['goods', 'material', 'consumable', 'equipment', 'quest', 'money']);
export const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);
export const ITEM_FIELDS = Object.freeze(['name', 'slug', 'aliases', 'kind', 'rarity', 'value', 'stack', 'slot', 'stats', 'effect', 'tags', 'note', 'carry', 'bonus', 'soak', 'weight']);
// A stat name as creation and items use it: STR, DEX … (short capital letters).
export const STAT_NAME = /^[A-Z]{2,12}$/;
