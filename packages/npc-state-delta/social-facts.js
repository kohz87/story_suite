/* Explicit unnamed social facts and unresolved graph slots.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { extractUnresolvedSocialFacts } from './social-facts-parts/extract.js';
export { collectiveDescriptorGrounded, existingEdgeProvesCollectiveMembership, ensureUnresolvedFacts, resolveSlotsFromEdges } from './social-facts-parts/slots.js';
