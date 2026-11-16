// Cast person list queries, status predicates, and summary counts.

import { isRecord } from './shared-checks.js';
import { tables } from './slice.js';

/** The people in key order, each `{ key, ...person }`. */
export function peopleOf(slice) {
    const { people } = tables(slice);
    return Object.keys(people).sort().filter(key => isRecord(people[key])).map(key => ({ key, ...people[key] }));
}

export const isMet = person => isRecord(person?.met);
/** Alive and in the world (a dead person is neither moved nor met). */
export const isAlive = person => person?.alive !== false;

/** How many people there are, and how many have been met (the dead count in the total: they were in the world). */
export function counts(slice) {
    const all = peopleOf(slice);
    return { total: all.length, met: all.filter(isMet).length };
}
