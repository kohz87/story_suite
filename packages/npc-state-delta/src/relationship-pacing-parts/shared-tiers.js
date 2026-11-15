// The impact tiers a paced event can have, and the whole-number test the pacing parts share.

export const PACING_TIERS = Object.freeze(['ordinary', 'meaningful', 'major', 'extreme']);
export const isInt = value => Number.isInteger(value);

/** The tier word of a payload, or null (an unknown or missing word is never "ordinary": it is not paced). */
export const pacedTier = value => (PACING_TIERS.includes(value) ? value : null);
