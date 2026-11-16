/* NPC State Delta identity and age helpers: clamp and value normalizers, identity kind, interim and role labels,
   slug/id/hash, age and apparent-age normalization. A pure part of core-mechanics.js (same owner, moved without
   change); core-mechanics.js re-exports every name it exported before. Imports only core-text.js.
   Public face: re-exports its parts. */
export { clamp, normalizeBoolean, normalizeGender, normalizeDossierSignal } from './core-identity-parts/values.js';
export { inferNpcIdentityKind, isRoleDescriptionLabel, isDescriptivePhrase, isInterimNpcLabel } from './core-identity-parts/kind.js';
export { identityLabelsRelated, findInterimIdentityPromotionIndex } from './core-identity-parts/promotion.js';
export { slugify, makeNpcId } from './core-identity-parts/ids.js';
export { AGE_NUMBER_WORD_RE } from './core-identity-parts/shared-age-text.js';
export { ageSpecificity, normalizeAge } from './core-identity-parts/age-chronological.js';
export { normalizeApparentAge } from './core-identity-parts/age-apparent.js';
export { normalizeAgeFields, normalizeStoredAgeFields } from './core-identity-parts/age-fields.js';
export { NPC_LIFE_STATES, normalizeLifeState } from './core-identity-parts/life-state.js';
