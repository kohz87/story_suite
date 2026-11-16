/* The known, inverse and blood-kin relation family tables.
   Part of social-relations.js; social-relations.js re-exports it. */

const KNOWN_SOCIAL_RELATION_FAMILIES = new Set([
    'child', 'parent', 'sibling', 'partner', 'mentor', 'student', 'guardian', 'ward',
    'friend', 'rival', 'cousin', 'aunt-uncle', 'niece-nephew', 'grandparent', 'grandchild',
    'parent-in-law', 'child-in-law', 'sibling-in-law',
]);

const INVERSE_SOCIAL_RELATION_FAMILIES = new Map([
    ['child', 'parent'], ['parent', 'child'], ['mentor', 'student'], ['student', 'mentor'],
    ['guardian', 'ward'], ['ward', 'guardian'], ['aunt-uncle', 'niece-nephew'], ['niece-nephew', 'aunt-uncle'],
    ['grandparent', 'grandchild'], ['grandchild', 'grandparent'],
    ['parent-in-law', 'child-in-law'], ['child-in-law', 'parent-in-law'], ['sibling-in-law', 'sibling-in-law'],
]);

const KINSHIP_RELATION_FAMILIES = new Set(['child', 'parent', 'sibling', 'cousin', 'aunt-uncle', 'niece-nephew', 'grandparent', 'grandchild']);

export { KNOWN_SOCIAL_RELATION_FAMILIES, INVERSE_SOCIAL_RELATION_FAMILIES, KINSHIP_RELATION_FAMILIES };
