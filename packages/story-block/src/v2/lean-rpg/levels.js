// Levels and ranks (Levels release). A character and a foe have a level, 1..99. A pack may name bands of levels, its ranks
// (`content.rpg.ranks`: [{ name, from, to }], packs/validate.js), and cap the level (`content.rpg.levelCap`).
//
//   packLevelsOf(records)         the `ranks` record of a pack's `packs.content` list of kind rpg → { ranks, levelCap, playerRank } (each may be absent), or null
//   rankOf(level, ranks)          the rank whose band holds the level → { name, from, to } | null
//   levelLabel(level, ranks)      "Rank E · Lv 14", or "Lv 14" when no rank holds the level (or there are none)
//   RANK_QUERY `rpg.rank`         { level } → { name } | null (the story's pack, or `ranks` in the arguments)
// Public face: re-exports its parts.

export { LEVEL_MIN, LEVEL_MAX, clampLevel } from './levels-parts/bounds.js';
export { SETTINGS_SCHEMA } from './levels-parts/settings.js';
export { RANK_QUERY, packLevelsOf, playerRankValue, rankQuery } from './levels-parts/pack-levels.js';
export { bandsOf, rankOf, levelLabel, rankNamed } from './levels-parts/ranks.js';
export { XP_RATE_SETTING, XP_RATE, xpRateOf, xpRateFrom } from './levels-parts/xp-rate.js';
export { scaleXp } from './levels-parts/scale-xp.js';
