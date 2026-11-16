// Field names, numeral styles and limits of a pack's display terms.

// Display terms a pack suggests (MODULES §F25): `{ id?, name?, levelName?, xpName?, tiers? }`, `tiers`
// being `true` or `{ size?, numerals?, enabled? }`. A term is a label in a module's blocks
// (`Soul Class: III (Lv 24)`), so it may not hold what separates fields there.
export const TERMS_FIELDS = Object.freeze(['id', 'name', 'levelName', 'xpName', 'tiers']);
export const TERMS_TIER_FIELDS = Object.freeze(['size', 'numerals', 'enabled']);
export const TERMS_NUMERALS = Object.freeze(['roman', 'arabic']);
export const TERMS_LIMITS = Object.freeze({ records: 4, term: 30, tierSize: 999 });
