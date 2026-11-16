// Story Director v2, part **arc**: answer size and item count caps for a plan.

/** The longest planner answer read, in characters; the rest is not looked at. */
export const MAX_ANSWER_CHARS = 32000;
/** Lines of the answer looked at; past them nothing is read. */
export const MAX_LINES = 80;
/** The most of each kind one plan keeps (in its order); the rest is left out, and the review says so. */
export const PLAN_CAPS = Object.freeze({ beat: 6, agenda: 6, hook: 3, clock: 2, secret: 4 });
/** Items one plan keeps in all (Story Director adds at most 16 threads for one reply, tracker/capture.js). */
export const MAX_ITEMS = 16;
