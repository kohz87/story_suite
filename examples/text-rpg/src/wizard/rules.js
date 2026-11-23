// Text RPG's creation rules as the wizard shows them (the `textRpg.create` command checks them again): 60 points over seven stats, each 5 to 15, up to five skills.

/** The numbers: the pool, a stat's bounds, the skills allowed, where each stat starts (they add up to the pool), the cost a skill can name. */
export const RULES = Object.freeze({
  total: 60, min: 5, max: 15, skills: 5, costMax: 9,
  start: Object.freeze({ str: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 }),
  nameMax: 60,
});
/** The seven stat keys with their long names (the Stats step's rows). */
export const STAT_NAME = Object.freeze({ str: 'Strength', vit: 'Vitality', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' });
/** Text RPG's skill types, as { value, label }. */
export const SKILL_TYPES = Object.freeze(['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) })));
/** What a skill can cost: nothing, Stamina (sp) or Mana (mp). */
export const COST_POOLS = Object.freeze([{ value: '', label: 'No cost' }, { value: 'sp', label: 'Stamina' }, { value: 'mp', label: 'Mana' }]);
