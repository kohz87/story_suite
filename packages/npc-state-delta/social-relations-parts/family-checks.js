/* Tests whether two relation families conflict or invert each other.
   Part of social-relations.js; social-relations.js re-exports it. */

import { socialRelationFamily } from './family-name.js';
import { INVERSE_SOCIAL_RELATION_FAMILIES, KINSHIP_RELATION_FAMILIES, KNOWN_SOCIAL_RELATION_FAMILIES } from './family-tables.js';

// Two different blood ties to the same person cannot both hold ("niece / sibling").
function conflictingKinship(a, b) {
    const left = socialRelationFamily(a);
    const right = socialRelationFamily(b);
    return KINSHIP_RELATION_FAMILIES.has(left) && KINSHIP_RELATION_FAMILIES.has(right)
        && left !== right && !inverseRelationFamilies(left, right);
}

function inverseRelationFamilies(a, b) {
    const left = KNOWN_SOCIAL_RELATION_FAMILIES.has(a) ? a : socialRelationFamily(a);
    const right = KNOWN_SOCIAL_RELATION_FAMILIES.has(b) ? b : socialRelationFamily(b);
    return Boolean(left && right && INVERSE_SOCIAL_RELATION_FAMILIES.get(left) === right);
}

export { conflictingKinship, inverseRelationFamilies };
