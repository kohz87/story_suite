// Repair on a miss (CHGDROP fix 1): when a captured reply came with no <Changes> block, one call on the Quick profile, with a prompt of its own
// (repair-parts/heads.js), reads the reply, the state lines before it and the kinds' grammar, and writes the block the reply should have had. Code keeps
// what the value wall lets through (safety.js; unlike the after-reply extractor a repair may write `+ coin`, `- coin`, `+ item` and `- item`),
// drops repeats, and hands the rest to the host's capture, which marks each as Assist's and stores them in the reply's <Changes-assist> section: swipe, middle
// delete, rewind, reload and Re-read replay the same lines and never call the model again. Runs whatever the extractor's switch says, only while its own
// switch (`assistRepair`, "Repair a reply's missing changes") is on, with the same 20 s time-out.
// Public face: re-exports its parts.

export { REPAIR_FOOT, REPAIR_HEAD, STATE_HEAD, REPAIR_REPLY_HEAD } from './repair-parts/heads.js';
export { REPAIR_REPLY_LIMIT, STATE_LIMIT, repairPrompt } from './repair-parts/prompt.js';
export { REPAIR_TOKENS, createRepairer } from './repair-parts/create.js';
