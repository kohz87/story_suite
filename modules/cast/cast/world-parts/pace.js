// Computing new-face pace limits and remaining meeting room.

import { DAY, FACES, DEFAULT_FACES, dayOf, isInt, isMet, peopleOf } from '../domain.js';

/** People one reply may bring. */
export const PER_REPLY = 1;

/** The pace setting: `{ count, days }`. */
export function paceOf(settings) {
    return FACES[settings?.faces] ?? FACES[DEFAULT_FACES];
}

/** How many new faces the pace still allows at story minute `now` (people met on the same story day, or in the last `days` days). */
export function roomLeft(slice, now, pace) {
    // Someone the story already had in the scene (`why: 'story'`) is no new face: they do not use up the pace.
    const met = peopleOf(slice).filter(person => isMet(person) && person.met.why !== 'story');
    const recent = met.filter(person => {
        const on = person.met.on;
        if (!isInt(on) || !isInt(now)) return true;
        return pace.days === 1 ? dayOf(on) === dayOf(now) : on > now - pace.days * DAY;
    });
    return Math.max(0, pace.count - recent.length);
}
