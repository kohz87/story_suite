/* Scanner social edges and canonical relationship alignment.
   Split from social.js; social.js remains the public facade. Public face: re-exports its parts. */

export { canonicalizeNpcKeyRelationships } from './social-scan-parts/canonicalize.js';
export { establishedCounterpartRelation, relationAgreement } from './social-scan-parts/established.js';
export { alignGraphWithCanonicalRelationships } from './social-scan-parts/align.js';
export { edgeDirectionGrounded, parseScanEdges, edgeFromKeyRelationship } from './social-scan-parts/edges.js';
