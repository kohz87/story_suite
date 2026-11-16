// The recovery constants: the full-rest wait, the hidden rested fields and the upward-set kinds.

/** Story hours between two full rests of one character. */
export const FULL_REST_HOURS = 6;
/** The hidden fields that keep the story minute of the character's last full rest. */
export const RESTED_FIELD = 'rested-at';
export const RESTED_KNOWN = 'rested-known';
/** The upward-set kinds and the bar each writes. */
export const SET_KINDS = Object.freeze({ 'set-health': 'health', 'set-stamina': 'stamina', 'set-mana': 'mana' });
