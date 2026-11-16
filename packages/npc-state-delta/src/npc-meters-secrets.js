// NPC meters, hidden notes (secrets): normalization, ids, the generated-note list, and the line forms of secrets and per-NPC
// limits. A pure part of npc-meters.js (same owner, moved without change); npc-meters.js re-exports every name it exported before.
// Never imports npc-meters.js.
// Public face: re-exports its parts.
export { normalizeSecrets, secretId, normalizeGeneratedSecrets } from './npc-meters-secrets-parts/notes.js';
export { secretsToLines, secretsFromLines } from './npc-meters-secrets-parts/note-lines.js';
export { limitsToLines, limitsFromLines } from './npc-meters-secrets-parts/limit-lines.js';
