// Story Director v2, part **cast**: the planner that moves the cast off-screen (pure apart from the model call it is handed).
//
// After a day change or a time skip, one model call looks at everyone in the world who can move (unmet and met alike) and answers
// with one short line per change, only where something changed. The answer is a proposal and nothing more (WAVE rule 1): code reads
// only three labels, only for people it named, cuts every part by code points with markup and control characters taken out, caps
// how many lines it keeps, and lets a death through only where the setting or the entry allows one (index.js). Nothing the planner
// writes sets an amount, and unmet people are never in the narrator's text: this prompt is the only place they are described.
//
//   ~ cast ref | place | what they are doing now        (moves on)
//   > cast ref | what in the story pulls them to {{user}}   (their goal brings them to the party; only for people with `drawnTo`)
//   ! cast ref | how they died                         (only for people marked "may die")
//   ? cast ref | "the words that ask for them"        (mode 'sought': the reader's message looks for a kind of person; sought.js checks the words)
//
// The same call, asked only for the `>` lines, judges a goal touched by the story between two days (index.js `touched`).
// Public face: re-exports its parts.

export { CAPS, MAX_PEOPLE_ASKED, MAX_SOUGHT, MAX_TOKENS } from './plan-parts/limits.js';
export { RECENT_CHARS, SOUGHT_CHARS, SOUGHT_SYSTEM, SYSTEM } from './plan-parts/prompts.js';
export { castRequest } from './plan-parts/request.js';
export { MAX_ANSWER_CHARS, MAX_LINES, readCast } from './plan-parts/read.js';
export { touches } from './plan-parts/touches.js';
export { createPlans } from './plan-parts/queue.js';
