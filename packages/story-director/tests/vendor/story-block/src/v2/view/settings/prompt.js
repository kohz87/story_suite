// The Prompt card of the Tabs & Packs page (UI stage, step 3e) and the footer bar's numbers: what Story Suite adds to the prompt of
// the next reply, counted now. Nothing is sent from here and nothing is stored but the budgets.
//
// * Budgets: the host's own `tailBudget` (a slider), `contextShare` (a slider) and `maxChangeLines` (a number), the form engine over
//   HOST_SETTINGS_SCHEMA, written through the same settings store as the Story Suite fold wrote through.
// * Prompt size: the estimate (four characters a token) at once, then SillyTavern's tokenizer's own counts when there is one: the
//   context size and Story Suite's share of it, the static part, this reply's part against its budget (a meter), what modules
//   send on their own, the total, and a table per module.
// * "Show what's sent": the exact text of each part, per module, with Copy (drawn while it is open: the texts are long).
//
// `createPromptReader` is the one reader of all this: the card and the window's footer bar both use it, so they always say the same.
// Every node is built with textContent; module names and texts are never markup.
//
// Public face: re-exports its parts.

export { PROMPT_FOLD, PROMPT_KEYS, PROMPT_TEXT, PROMPT_SCHEMA } from './prompt-parts/text.js';
export { createPromptReader, footerSummary } from './prompt-parts/reader.js';
export { paintSize } from './prompt-parts/size.js';
export { renderPromptCard } from './prompt-parts/card.js';
