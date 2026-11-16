// Pure board choices for weapon attacks and automatic defence.
// They read a character's effective stats, skills and equipped weapon; they write no sheet state.
// The ordinary roll code still performs the dice and spends any resource.
// Public face: re-exports its parts.
export { attackStat, bestDefence } from './rules-parts/weapons.js';
export { RECOVERY_BLOCKS, RECOVERY_POOLS, recoveryOf, recoverBar } from './rules-parts/recovery.js';
export { maxOf, recoverPool, consumablesIn, allyBars } from './rules-parts/recover-pool.js';
