// The board's skill flags, inferred from a skill's words until the reader edits them.
// The defaults are a read only: old skill blocks and old roll records stay untouched.
// Overrides are keyed by the block, slot and skill name, so a replacement skill starts fresh.
// Public face: re-exports its parts.

export { healingSkill } from './flags-parts/healing.js';
export { defaultFlags, isUtility, skillFlags } from './flags-parts/skill-flags.js';
export { skillKey } from './flags-parts/skill-key.js';
export { hardFightFor } from './flags-parts/hard-fight.js';
