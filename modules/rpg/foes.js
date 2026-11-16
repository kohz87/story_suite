// Foes by level (Levels release). A foe group has a level, 1..99, instead of a Soul Class. Pure helpers, no imports but the seeded generator:
// - the roll term (`levelBonus`) and a Standard foe's Health blocks (`foeBlocksByLevel`);
// - where a level comes from (`pickLevel`): the line gave it (`level: N`), or gave a rank (a seeded level inside that rank's band), or neither (a seeded level
//   within ±2 of the party's average level, held to 1..99). The seed is the reply's own dice seed, so a swipe (a new seed) draws a new level and a
//   Re-read (the same seed) keeps it;
// - `bandOfRank`: a rank's band, found through the `rpg.rank` query (`{ level }` → `{ name } | null`) by asking for each level.
// Public face: re-exports its parts.
export { LV_VERSION, classOfLevel, levelBonus } from './foes-parts/level-marks.js';
export { levelOfClass, FOE_LEVEL, levelOf } from './foes-parts/level-basics.js';
export { foeBlocksByLevel, hardBlocksByLevel, isHardBar } from './foes-parts/health-blocks.js';
export { foeLevelCap, averageLevel, partyLevels } from './foes-parts/party-levels.js';
export { pickLevel, foeRandom, settleOpen } from './foes-parts/pick-level.js';
export { bandOfRank, foeLabel } from './foes-parts/rank-band.js';
