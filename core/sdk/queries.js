// Queries and views for the public sdk: run a registered query with its tools, mount the same over a
// state, build the view modules read, and find modules whose domains the head state still lacks.
// Public face: re-exports its parts.

export { withCue, runQuery, mountQuery } from './queries-parts/run.js';
export { makeView, featureOn } from './queries-parts/view.js';
export { missingModules } from './queries-parts/missing.js';
