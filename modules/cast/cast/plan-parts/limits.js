// Story Director v2, part **cast**: caps and limits for cast planner requests and responses.

/** The most lines of each label one answer keeps. */
export const CAPS = Object.freeze({ move: 16, come: 3, die: 2, seek: 1 });
/** The most people one call describes. */
export const MAX_PEOPLE_ASKED = 24;
export const MAX_TOKENS = 700;
/** The most people a 'sought' call describes. */
export const MAX_SOUGHT = 8;
