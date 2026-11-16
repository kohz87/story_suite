// Prompt assembly (docs/v2/SPEC.md §5): the two texts Story Block sends for every ordinary reply.
//
// - static: the change-line instruction (a fixed header, then each module's kind grammar in
//   module-id order) and each module's context.static() in module-id order. It never reads the
//   state, so it is byte-identical reply after reply and a provider's prompt cache keeps it.
// - tail: `[Happened]` with one code-written line per untold receipt, then each module's
//   context.tail(view) in the fixed order scene, inventory, party, combat, trade, director, then
//   other modules by id; sent last (depth 0), where text that changes belongs.
//
// Budgets are tokens estimated at four characters each. A module's optional lines go first when
// it is over its own budget, then its last lines; past the host's total budget the same happens
// from the last module back. The first [Happened] lines are never dropped: they are what the reply
// must tell. Past half the total budget (and the first MIN_HAPPENED of them) the rest are told as one
// counted line, "…and N more things happened." Names (`{{user}}`, `{{char}}`) are filled in before
// anything is counted, so a long name cannot push a text past its budget. Pure: no DOM, no SillyTavern.
//
// The context size (final soak): SillyTavern fits the extension prompts first and drops the conversation
// when the rest no longer fits, so Story Suite in all (static + tail) is held to a share of the room the
// prompt has (the context size less the reply's length; `contextShare` percent, default 40). Only the
// tail is cut for it, never below MIN_TAIL_BUDGET: the static part stays byte-identical reply to reply.
// When the static part alone is over the share, `fit.tooSmall` says so (turn.js tells the reader).
// What a module sends on its own (NPC State Delta's dossiers, under its own prompt keys; its
// `ownPrompt` hook says what, turn.js ownPrompt) counts toward the share too: the tail gets what the
// static part and that leave, still never below MIN_TAIL_BUDGET. It never cuts the static part.

// Public face: re-exports its parts.

export { TAIL_ORDER, tailOrder } from './prompt-parts/tail-order.js';
export { DEFAULT_TAIL_BUDGET, KEPT_TAIL_LINES, KEPT_TAIL_TOKENS, MIN_TAIL_BUDGET } from './prompt-parts/tail-budget.js';
export { DEFAULT_CONTEXT_SHARE, CONTEXT_SHARE_MIN, CONTEXT_SHARE_MAX } from './prompt-parts/share-limits.js';
export { HAPPENED, MIN_HAPPENED, STATIC_MARKER } from './prompt-parts/markers.js';
export { estimateTokens } from './prompt-parts/shared-helpers.js';
export { staticParts, staticTextWith } from './prompt-parts/static.js';
export { contextFit, contextNotice } from './prompt-parts/context-fit.js';
export { assemble } from './prompt-parts/assemble.js';
