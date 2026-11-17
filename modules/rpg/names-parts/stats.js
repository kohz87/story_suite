// The stat keys: Combat Rules v1's seven, and every key a file or a line may still name.
export const STATS_V1 = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);
/** The seven every chat has (Combat Rules v1's). */
export const STATS = STATS_V1;
/** Every key a reader that only accepts a name takes: the seven and LUK, which a file or a line from before Combat Rules v1 may still say (read as WIS). */
export const STATS_ANY = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha', 'wis']);
