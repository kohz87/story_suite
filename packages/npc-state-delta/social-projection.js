/* Projection of the social graph into Important Bonds and id remapping.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { resolvedCollectiveGroup, enrichCollectiveDynamic } from './social-projection-parts/collective-groups.js';
export { projectGraphToKeyRelationships } from './social-projection-parts/key-relationship-projection.js';
export { remapSocialGraphNpcIds, remapSocialGraphNpcId } from './social-projection-parts/id-remap.js';
export { purgeNpcStructuredReferences, removeNpcFromSocialGraph, socialGraphLabelsForNpc } from './social-projection-parts/npc-removal.js';
