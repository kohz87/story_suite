/* Social relation families, inverse/sanitization rules and shared relation parsing.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { socialRelationFamily } from './social-relations-parts/family-name.js';
export { KNOWN_SOCIAL_RELATION_FAMILIES, INVERSE_SOCIAL_RELATION_FAMILIES, KINSHIP_RELATION_FAMILIES } from './social-relations-parts/family-tables.js';
export { conflictingKinship, inverseRelationFamilies } from './social-relations-parts/family-checks.js';
export { relationshipSubjectLooksStructured, ORPHAN_LIFE_STATE, preserveUnstructuredRelationshipText, kinshipParts } from './social-relations-parts/relation-text.js';
export { splitRelationDynamic, withFoldedDynamic } from './social-relations-parts/relation-dynamic.js';
export { GENDERED_RELATION_PAIRS, genderedRelation } from './social-relations-parts/relation-gender.js';
export { sanitizeRelationshipRelation } from './social-relations-parts/relation-sanitize.js';
export { MUTUAL_RELATION_QUALIFIERS, SYMMETRIC_RELATION_WORD, symmetricInverse } from './social-relations-parts/relation-symmetric.js';
export { inverseSocialRelation, inverseSingleRelation } from './social-relations-parts/relation-inverse.js';
export { relationSpecificity, mergeRelations } from './social-relations-parts/relation-merge.js';
export { numberWord, singularRelation, collectiveRelationshipShape } from './social-relations-parts/relation-collective.js';
