// Field names, stats, resources and types of a cast member's signature skills.

// A cast member's signature skills (`cast[].skills`): the same seven stats as the RPG's (lean-rpg/names.js STATS, pinned by a test), the ranks, the resources and the most a person brings (lean-rpg/names.js SKILL_SLOTS_MAX, pinned too).
export const CAST_SKILL_FIELDS = Object.freeze(['name', 'about', 'stat', 'uses', 'rank', 'type']);
export const CAST_SKILL_STATS = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'wis', 'cha']);   // (LUK is read as WIS by a v1 sheet)
export const CAST_SKILL_USES = Object.freeze(['stamina', 'mana']);
// A cast skill's optional `type`: `combat` (the default when absent) or `utility` (a utility slot of the Skills block, story only).
export const CAST_SKILL_TYPES = Object.freeze(['combat', 'utility']);
