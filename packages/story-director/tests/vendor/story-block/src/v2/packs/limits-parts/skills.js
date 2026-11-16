// Skill template and preset field names, types and targets.

// A skill template: numbers are supplied by the consuming module.
export const SKILL_FIELDS = Object.freeze(['name', 'slug', 'type', 'stat', 'target', 'element', 'note', 'tags']);
export const SKILL_TYPES = Object.freeze(['physical', 'magic', 'heal', 'buff', 'debuff']);
export const SKILL_TARGETS = Object.freeze(['one', 'all', 'self', 'ally', 'allies']);
export const PRESET_FIELDS = Object.freeze(['id', 'name', 'note', 'race', 'talents', 'points', 'skills']);
