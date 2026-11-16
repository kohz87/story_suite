// Story Suite v2: the turn's pure text helpers (moved out of turn.js unchanged; turn.js re-exports the public ones). How a prompt's
// message content is read and rewritten (string or multimodal parts), names filled in for {{user}} / {{char}}, macros defused so
// SillyTavern leaves a story-introduced name alone, the battle-log marker lines dropped from history, the context room the
// prompt has, a quiet generation's mark, and putting back static / tail text SillyTavern left out. None of it reads the turn's state.
// Public face: re-exports its parts.

export { QUIET_KEEP, QUIET_MARK_MIN, QUIET_WAIT_MS, quietMark } from './text-parts/quiet-mark.js';
export { TIMED_OUT, within } from './text-parts/timeout.js';
export { stripBattleMarker } from './text-parts/battle-marker.js';
export { contextRoom } from './text-parts/context-room.js';
export { MAX_NAME, defuseMacros, flatName, substituteNames } from './text-parts/names.js';
export { contentText, firstLine, mapContent } from './text-parts/content.js';
export { restoreMissing, textPattern } from './text-parts/restore-missing.js';
export { CLOSING_CUE_TAIL, appendClosingCue, closingCue } from './text-parts/closing-cue.js';
export { KEPT_CHARS_MAX, KEPT_LINES_MAX, keptGiven } from './text-parts/kept-lines.js';
