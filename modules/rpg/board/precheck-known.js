// What the foe pre-check's prompt may add from the world, read once per send and handed to precheckPrompt as plain strings:
// the story's rank scale (the source `rpg.rank` reads: the pack's `ranks` record) and a short line for each person the message
// or the reply before it names (NPC State Delta's `npc.known` / `npc.dossier`, when it answers). Read only: nothing is written and
// nothing is asked of a model. The prompt is only the INPUT of the Assist call, whose vetted result is what gets recorded, so
// replay never rebuilds this text and never depends on live NPC state.
// Public face: re-exports its parts.

export { KNOWN_LIMITS, occurs, knownLines } from './precheck-known-parts/known-lines.js';
export { wordsOf } from './precheck-known-parts/shared-text.js';
export { rankScale } from './precheck-known-parts/rank-scale.js';
