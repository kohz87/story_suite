// A turn (docs/v2/SPEC.md §4, §5): Story Suite's SillyTavern wiring.
//
// Before the reply (the generation interceptor, for normal, swipe, regenerate and continue):
// flush pending saves, let modules add cues (beforeGenerate), collect the untold receipts and
// assemble the two prompt texts; the static part goes in-prompt, this reply's part in-chat at
// depth 0. The interceptor's context size holds them to a share of it (prompt.js contextFit): the
// tail is cut to fit (what modules send under their own keys, their `ownPrompt` hooks, counts toward it
// too), and when the static part alone is too big the reader is told once per chat. Quiet and impersonate generations (and any other kind) get both slots emptied.
// At prompt-ready: hidden change blocks leave the prompt history, and when the preset left out
// the Main Prompt (SillyTavern then drops in-prompt text) the static part is put back at the
// start of this reply's part, for the story's own prompt only.
// A module's canGenerate hook may stop a story generation first (the interceptor's abort).
// After the reply (MESSAGE_RECEIVED for the carrier the interceptor prepared): read its
// <Changes> block, run each line as its owner's capture command (cause 'story'), append what
// was accepted, run each module's afterCapture hook once after the reply's last story line (its
// commands as `system` steps kept on the reply), record what the reply was told, save once. A line no module takes, or one its
// owner rejects, goes to the Problems list; nothing is thrown at the reader.
// A failed save (before or after the reply) is told and logged but never drops the turn: the state
// stays in memory, marked unsaved, and the save is tried again after the reply.
//
// turn.js receives the SillyTavern context and the host parts; it never imports the store or
// the command bus (their interfaces are docs/v2/SPEC.md §12).
// Public face: re-exports its parts.

export { QUIET_MARK_MIN, QUIET_WAIT_MS, MAX_NAME, stripBattleMarker, contextRoom, defuseMacros, flatName, substituteNames, quietMark, restoreMissing } from './turn/text.js';
export { STATIC_KEY, TAIL_KEY, V1_KEYS, INTERCEPTOR_NAME } from './turn-parts/keys.js';
export { FOREGROUND, OWN_PROMPT_PARTS, OWN_PROMPT_CHARS, normalizeType } from './turn-parts/prompt-limits.js';
export { HOOK_TIMEOUT_MS, hookTimeout } from './turn-parts/hook-time.js';
export { REPLY_BUSY_MAX_MS, ASSIST_WAIT_MS, RPG_LOAD_WAIT_MS } from './turn-parts/waits.js';
export { createTurn } from './turn-parts/create-turn.js';
