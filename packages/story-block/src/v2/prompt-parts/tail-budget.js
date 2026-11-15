// Story Suite v2: the default and minimum tail budgets and the caps on kept tail lines.

export const DEFAULT_TAIL_BUDGET = 1500;
// A module's own tail lines may be `{ text, keep: true }` (kept whole whatever the budget says): at most KEPT_TAIL_LINES per module, and
// KEPT_TAIL_TOKENS in all per reply, counted after names are filled in and shared with the kept prelude cues (`keptTokens` of assemble).
export const KEPT_TAIL_LINES = 4;
export const KEPT_TAIL_TOKENS = 120;
// A tail cut for a small context keeps at least this many tokens (the [Happened] lines and the first
// required lines are what the reply must tell).
export const MIN_TAIL_BUDGET = 200;
