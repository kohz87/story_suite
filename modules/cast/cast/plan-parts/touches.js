// Story Director v2, part **cast**: checking whether the recent story touches a person's `drawnTo` phrases.

import { words } from '../sought.js';

/**
 * Whether the recent story touches one of a person's `drawnTo` phrases: all the telling words of a short phrase, two thirds of a longer
 * one, each as a whole word (a plural or a past tense with the same first five letters counts). A cheap check in code, so the planner
 * is asked about a goal only when the story came near it.
 */
export function touches(drawnTo, recent) {
    const have = new Set(words(recent));
    const stems = new Set([...have].map(word => word.slice(0, 5)));
    for (const phrase of Array.isArray(drawnTo) ? drawnTo : []) {
        const need = [...new Set(words(phrase))];
        if (!need.length) continue;
        const found = need.filter(word => have.has(word) || have.has(`${word}s`) || have.has(`${word}es`) || (word.length >= 5 && stems.has(word.slice(0, 5)))).length;
        if (found >= (need.length <= 2 ? need.length : Math.ceil((need.length * 2) / 3))) return true;
    }
    return false;
}
