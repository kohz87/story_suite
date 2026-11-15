// Cast prompt tail budget and planner call timeout constants.

/** The most tokens the narrator's cue for a meeting may take (the module's tail budget gains this). */
export const TAIL_BUDGET = 220;
/** How long a reply waits for the planner's answer, and the limit the model call is given (milliseconds). */
export const HOLD_MS = 15000;
export const CALL_MS = 45000;
export const HOOK_MS = HOLD_MS + 5000;
