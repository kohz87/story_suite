// The meter family of each tie tag and which tags read one way (Name to Other). Parse-only: nothing writes or teaches these tags yet.
// kin, partner, friend and ally pull toward the ally family; rival and enemy toward hostile; mentor, serves and owes have no pull of their own.
export const TIE_FAMILIES = Object.freeze({
    ally: Object.freeze(['kin', 'partner', 'friend', 'ally']),
    hostile: Object.freeze(['rival', 'enemy']),
    none: Object.freeze(['mentor', 'serves', 'owes']),
});
export const ONE_WAY_TAGS = Object.freeze(['mentor', 'serves', 'owes']);
