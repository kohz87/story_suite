/* NPC State Delta key-relationship edges: compacting, subject matching, merging and normalizing key-relationship entries/edges,
   applying edges across NPCs, and extracting explicit edges from text, with KEY_RELATIONSHIP_LIMIT. A pure part of
   core-mechanics.js (same owner, moved without change); core-mechanics.js re-exports every name it exported before.
   Imports only core-text.js and social.js. Public face: re-exports its parts. */
export { KEY_RELATIONSHIP_LIMIT, compactKeyRelationshipEntry, keyRelationshipSubject } from './core-keyrel-parts/entries.js';
export { mergeKeyRelationshipUpdates } from './core-keyrel-parts/merge.js';
export { TIE_TYPE_LABELS, TIE_TYPE_RANK, TIE_FADE_DAYS, tieType } from './core-keyrel-parts/tie-types.js';
export { tiesTracked, tieRoster, readTieRows, narratorTies } from './core-keyrel-parts/tie-rows.js';
export { recordTieMentions, noteTieTags, cleanTieSeen } from './core-keyrel-parts/tie-mentions.js';
export { normalizeKeyRelationshipEdges } from './core-keyrel-parts/edges.js';
export { applyKeyRelationshipEdges } from './core-keyrel-parts/apply-edges.js';
export { extractExplicitKeyRelationshipEdges } from './core-keyrel-parts/explicit-edges.js';
