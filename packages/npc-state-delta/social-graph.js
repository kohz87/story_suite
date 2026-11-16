/* Social graph shapes, normalization, edge merging and reference resolution.
   Split from social.js; social.js remains the public facade.
   Public face: re-exports its parts. */

export { resolveNpcId, resolveNpcReference, npcLabels } from './social-graph-parts/npc-reference.js';
export { optionalTurn, edgeKey, normalizeEdge, normalizeUnresolved } from './social-graph-parts/edge-shape.js';
export { normalizeSocialGraph } from './social-graph-parts/graph-normalize.js';
export { addEdge, relationFromPerspective, pairConnects } from './social-graph-parts/edge-merge.js';
