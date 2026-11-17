// The skill words of Combat Rules v1 a pack may write (pinned to modules/rpg/combat/numbers.js and names-parts/stats.js by a test): the types, the ranks and the resource words.

export const SKILL_TYPES_V1 = Object.freeze(['attack', 'area', 'defence', 'evasion', 'movement', 'heal', 'support', 'utility']);
export const SKILL_RANKS_V1 = Object.freeze(['novice', 'apprentice', 'adept', 'expert', 'master', 'grandmaster', 'legend']);
// `uses` names the pool a skill draws on: SP or MP. `stamina` and `mana` (the older words) are still accepted and mean the same.
export const SKILL_USES_V1 = Object.freeze({ sp: 'sp', mp: 'mp', stamina: 'sp', mana: 'mp' });
// The older words a pack may still write: `combat` is read as `attack`.
export const SKILL_TYPE_ALIASES = Object.freeze({ combat: 'attack' });
