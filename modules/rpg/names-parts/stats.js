// The stat keys: v1's seven, the earlier rules' seven, and every key either knows.
export const STATS_V1 = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);
/** The seven every chat has (Combat Rules v1's). */
export const STATS = STATS_V1;
/** The earlier rules' seven (LUK for WIS). */
export const STATS_EARLIER = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'luk', 'cha']);
/** Every key either knows, for a reader that only accepts a name. */
export const STATS_ANY = Object.freeze([...STATS_EARLIER, 'wis']);
