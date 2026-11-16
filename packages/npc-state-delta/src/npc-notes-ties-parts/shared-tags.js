// The tie tags and the canonical tag order every ties part shares, with the plain-object test.
// Nine tags (owner 16 Nov): kin, partner, friend, ally, rival, enemy both ways; mentor, serves, owes read Name to Other.
// The order keeps the old three (ally, rival, owes) in their old relative order, so a stored tie with an old tag still reads.
export const TIE_TAGS = ['kin', 'partner', 'friend', 'ally', 'mentor', 'serves', 'rival', 'enemy', 'owes'];
export const TIES_MAX_PEOPLE = 12;

export const ordered = tags => TIE_TAGS.filter(tag => tags.includes(tag));
export const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
