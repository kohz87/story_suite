// Field names and limits of the RPG content (skill sets for the New character wizard).

// Skill sets for the RPG's New character wizard, `content.rpg.skillSets` (normalized to a list of sets):
// `[{ name, slug?, about?, skills: [{ name, about, stat, uses? }] }]`. The limits follow the Skills block's fields; `stats` and `uses`
// are the words the block's `statN` and `usesN` take (src/v2/lean-rpg/names.js STATS and USES, kept apart so packs need nothing of it).
export const LEAN_RPG_FIELDS = Object.freeze(['skillSets', 'formula', 'numbers', 'ranks', 'levelCap', 'playerRank']);
export const SKILL_SET_FIELDS = Object.freeze(['name', 'slug', 'about', 'skills']);
export const SKILL_SET_SKILL_FIELDS = Object.freeze(['name', 'about', 'stat', 'uses']);
export const LEAN_RPG_LIMITS = Object.freeze({ sets: 12, skills: 5, name: 40, about: 160, skillName: 40, skillAbout: 120,
    stats: Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha']), uses: Object.freeze(['stamina', 'mana']) });
