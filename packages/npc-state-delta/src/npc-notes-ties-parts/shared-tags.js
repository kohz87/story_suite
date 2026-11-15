// The tie tags and the canonical tag order every ties part shares, with the plain-object test.
export const TIE_TAGS = ['ally', 'rival', 'owes'];
export const TIES_MAX_PEOPLE = 12;

export const ordered = tags => TIE_TAGS.filter(tag => tags.includes(tag));
export const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
