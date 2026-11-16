// Names: block roles and the seven stats.

/** `role` on a block definition: what the RPG reads it as. A Character, Skills or Foes block names its `who`. */
export const ROLES = Object.freeze(['character', 'skills', 'foes', 'rules']);

/** The roles whose blocks get no tab of their own while the feature is on (the Party tab draws them, the Fight tab the Foes block; they stay in Settings → Blocks). */
export const ROLES_WITHOUT_TAB = Object.freeze(['character', 'skills', 'foes', 'rules']);

/** The seven stats, 1–20 each (a pack may rename them through its Character template's field labels). */
export const STATS = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha']);

/** The seven stats of Combat Rules v1, 1–30 each (WIS where the earlier rules had LUK): the v1 Character block's fields. */
export const STATS_V1 = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);
