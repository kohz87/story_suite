// The two line patterns the chatter and World State readers share: a rule between turns and a bracketed placeholder.
// `---`, `***`, `___` between turns, and a block's own `[placeholder]` echoed back.
export const RULE = /^(?:[-*_]\s*){3,}$/;
export const PLACEHOLDER = /^\[[\s\S]*\]$/;
