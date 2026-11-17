// Field names, stats, resources and types of a cast member's signature skills.

import { SKILL_TYPES_V1, SKILL_USES_V1, SKILL_TYPE_ALIASES } from './skill-words.js';

// A cast member's signature skills (`cast[].skills`): the seven stats of Combat Rules v1 (LUK, which format 2 packs wrote, is read as WIS), the ranks, the resources and the most a person brings (lean-rpg/names.js SKILL_SLOTS_MAX, pinned by a test).
export const CAST_SKILL_FIELDS = Object.freeze(['name', 'about', 'stat', 'uses', 'rank', 'type']);
export const CAST_SKILL_STATS = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'wis', 'cha']);
// `uses`: sp or mp (stamina and mana still accepted). `type`: one of the eight v1 types (`combat` is read as `attack`); a skill with none is an attack.
export const CAST_SKILL_USES = Object.freeze(Object.keys(SKILL_USES_V1));
export const CAST_SKILL_TYPES = Object.freeze([...SKILL_TYPES_V1, ...Object.keys(SKILL_TYPE_ALIASES)]);
