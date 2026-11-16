// The gear record's version mark and the stat limits gear works with (the version, the stat ceiling, the encumbered penalty and the stats it hits).


export const GEAR_VERSION = 1;
/** A stat with gear added up may pass 20 but never this (GEAR.effectiveMax of the inventory side). */
export const STAT_MAX = 30;
/** The penalty to AGI and DEX while a member carries more than they can (the inventory's ENCUMBERED_PENALTY). */
export const ENCUMBERED = -2;
export const ENCUMBERED_STATS = Object.freeze(['agi', 'dex']);
