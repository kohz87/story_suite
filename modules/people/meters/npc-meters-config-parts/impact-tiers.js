// The impact tiers of a story line and the reader of a tier word.

// The impact tiers of a story line (`| impact: major`), the scanner's own: the line's step is held to the tier's cap
// (the reader's relationshipCaps). A missing or unknown tier is the smallest.
export const IMPACT_TIERS = Object.freeze(['ordinary', 'meaningful', 'major', 'extreme']);
export const tierOf = raw => {
    const word = String(raw ?? '').trim().toLowerCase().split(/[^a-z]+/)[0];
    return IMPACT_TIERS.includes(word) ? word : 'ordinary';
};
