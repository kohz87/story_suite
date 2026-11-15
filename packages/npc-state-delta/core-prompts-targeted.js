/* NPC State Delta targeted prompt builders: output caps/return shapes, backfill, dossier import and profile refresh.
   Split from core-prompts.js without change; core-prompts.js re-exports every name it exported before.
   Public face: re-exports its parts. */
export { BEHAVIOR_LEVER_LABELS, PROMPT_CAPS, PROFILE_STYLE_LINE, returnShape } from './core-prompts-targeted-parts/prompt-shared.js';
export { buildBackfillPrompt } from './core-prompts-targeted-parts/backfill.js';
export { buildDossierImportPrompt } from './core-prompts-targeted-parts/dossier-import.js';
export { STALE_PROFILE_TURNS, STALE_PROFILE_DAYS, buildProfileRefreshPrompt } from './core-prompts-targeted-parts/profile-refresh.js';
