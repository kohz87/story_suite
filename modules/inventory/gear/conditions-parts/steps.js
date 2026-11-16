// Stepping a piece's condition down (wear) or up (repair) the words.

import { CONDITION, condWord } from './words.js';

/** The condition after `steps` steps down the words: good → worn (69) → torn (39) → broken (0). */
export function stepDown(cond, steps = 1) {
    let now = Number.isFinite(cond) ? cond : 100;
    for (let n = 0; n < steps; n += 1) now = condWord(now) === 'good' ? CONDITION.good.min - 1 : condWord(now) === 'worn' ? CONDITION.worn.min - 1 : 0;
    return now;
}

/** The condition after one step up the words (broken → torn 39 → worn 69 → good 100), or all the way (`restore`) back to Good. */
export function stepUp(cond, restore = false) {
    const word = condWord(cond);
    if (restore || word === 'worn') return 100;
    return word === 'good' ? 100 : word === 'torn' ? CONDITION.good.min - 1 : CONDITION.worn.min - 1;
}
