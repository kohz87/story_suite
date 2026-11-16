// Selecting movable cast members, building planner refs, and counting nearby unmet people.

import { atParty } from '../entries.js';
import { isAlive, isInt, isMet, keysOfPerson, peopleOf } from '../domain.js';

/**
 * Everyone who can be moved: alive, their entry readable now, not in the scene, not pinned as Key people, joined before `to`.
 * The most stale first. Each: `{ key, ref, person, entry, met, mayDie }`.
 */
export function movable(slice, cast, { to = null, present = new Set(), pinned = new Set(), unmetDie = false } = {}) {
    const out = [];
    for (const person of peopleOf(slice)) {
        const entry = cast.byKey.get(person.key);
        if (!entry || !isAlive(person)) continue;
        if (isInt(to) && isInt(person.since) && person.since >= to) continue;
        const keys = keysOfPerson(person);
        if (keys.some(key => present.has(key) || pinned.has(key))) continue;
        const met = isMet(person);
        out.push({ key: person.key, person, entry, met, mayDie: !met && (unmetDie || entry.canDieUnmet === true) });
    }
    out.sort((a, b) => (a.person.since ?? -Infinity) - (b.person.since ?? -Infinity) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    // A ref is the entry's id when it is the only one in this list, else the whole key.
    const ids = new Map();
    for (const item of out) ids.set(item.entry.id.toLowerCase(), (ids.get(item.entry.id.toLowerCase()) ?? 0) + 1);
    for (const item of out) item.ref = ids.get(item.entry.id.toLowerCase()) > 1 ? item.key.toLowerCase() : item.entry.id.toLowerCase();
    return out;
}

/** The planner's view of a movable person. */
export const askedAbout = item => ({
    ref: item.ref, name: item.person.name, goal: item.entry.goal, routine: item.entry.routine, where: item.person.where, doing: item.person.doing,
    drawnTo: item.met ? [] : item.entry.drawnTo, met: item.met, mayDie: item.mayDie,
});

/** `refs` (ref → key) of a list of movable people. */
export const refsOf = list => new Map(list.map(item => [item.ref, item.key]));

/** Unmet, living people in the world's pack whose place is the party's now: how many "may cross your path here". */
export function nearCount(slice, cast, { party = {}, present = new Set(), pinned = new Set() } = {}) {
    return movable(slice, cast, { present, pinned }).filter(item => !item.met && atParty(item.person.where, party)).length;
}
