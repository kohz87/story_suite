// The milestone and description length limits, the tail secret count and the context budget.

export const MILESTONE_MAX = 60;
export const DESCRIBE_MAX = 100;
export const TAIL_SECRETS_PER_NPC = 3;
// About 325 tokens for the notes and meters lines (the required not-yet-told line and its two once-said sentences among them), plus about 55 for the kept Changes cue
// (npc-meters-prompt.js), which is always sent. 305 until 26 Nov. The budget is fixed: with Dossier notes off (no cue) the section has those 55 tokens more.
export const CONTEXT_BUDGET = 380;
