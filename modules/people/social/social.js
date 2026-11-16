/* Public social-graph facade. Cohesive implementation parts live in social-*.js. Public face: re-exports its parts. */
export { reconcileSocialState } from './social-parts/reconcile.js';
export {
    SOCIAL_GRAPH_VERSION, SOCIAL_GRAPH_EDGE_LIMIT, SOCIAL_GRAPH_UNRESOLVED_LIMIT,
    SOCIAL_GRAPH_SUPPRESSED_LIMIT, SOCIAL_KEY_RELATIONSHIP_MAX_CHARS, SOCIAL_DYNAMIC_MAX_CHARS,
} from './social-primitives.js';
export { socialRelationFamily, inverseSocialRelation } from './social-relations.js';
export { parseKeyRelationshipEntry, compactSocialKeyRelationship } from './social-bonds.js';
export { resolveNpcId, resolveNpcReference, normalizeSocialGraph } from './social-graph.js';
export { canonicalizeNpcKeyRelationships } from './social-scan.js';
export { extractUnresolvedSocialFacts } from './social-facts.js';
export {
    remapSocialGraphNpcIds, remapSocialGraphNpcId,
    purgeNpcStructuredReferences, removeNpcFromSocialGraph, socialGraphLabelsForNpc,
} from './social-projection.js';
export { applyManualKeyRelationshipEdit } from './social-manual.js';
