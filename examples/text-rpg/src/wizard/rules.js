// Text RPG's creation rules as the wizard shows them (the `textRpg.create` command checks them again), the RPG's: every stat starts at 5, 10 points to spend, a stat up to 10 (45 in all), five skill slots.

/** The numbers: the pool, a stat's bounds, the skills allowed, where each stat starts (they add up to the pool), the cost a skill can name. */
export const RULES = Object.freeze({
  total: 45, points: 10, min: 5, max: 10, skills: 5, costMax: 9,
  // A saved character's stats are held to 5..15 (the sheet's own limit is 30; the RPG's file allows more).
  importMax: 15,
  start: Object.freeze({ str: 5, vit: 5, agi: 5, dex: 5, int: 5, wis: 5, cha: 5 }),
  nameMax: 60,
});
/** The seven stat keys with their long names (the Stats step's rows). */
export const STAT_NAME = Object.freeze({ str: 'Strength', vit: 'Vitality', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' });
/** Text RPG's skill types, as { value, label }. */
export const SKILL_TYPES = Object.freeze(['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) })));
/** What a skill can cost: nothing, Stamina (sp) or Mana (mp). */
export const COST_POOLS = Object.freeze([{ value: '', label: 'No cost' }, { value: 'sp', label: 'Stamina' }, { value: 'mp', label: 'Mana' }]);
