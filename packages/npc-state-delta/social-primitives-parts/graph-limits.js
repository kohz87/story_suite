/* Limits on how many edges, open slots and removals the social graph keeps.
   Part of social-primitives.js; social-primitives.js re-exports it. */

export const SOCIAL_GRAPH_VERSION = 1;

export const SOCIAL_GRAPH_EDGE_LIMIT = 240;

export const SOCIAL_GRAPH_UNRESOLVED_LIMIT = 120;

// Manual sibling removals; sized to the edge cap so a large family never silently loses a removal.
export const SOCIAL_GRAPH_SUPPRESSED_LIMIT = 240;
