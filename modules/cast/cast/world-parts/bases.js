// The living cast and the world's latest base (switch story-director.world-events; spec v0.14.9 §8 Event moves, Latest base wins;
// seam audit E1). A person's `base` slot { at, since, routine, by } is written by an event or Director move (the world's daily step),
// a story move or a stays record (cast.story). While the switch is on and they have one: the day planner is told the base as where
// they are and its routine; a planner move away from it is dropped by code; no goal pull starts a journey or a meeting for them (the
// planner cannot pull them back that way either). With the switch off nothing here applies (all as before). Pure.

import { samePlace } from '../entries.js';
import { slotOf } from '../domain.js';

/** The person's base `{ at, since, routine, by }` while the switch is on (`on`), else null. */
export function baseOf(person, on) {
    if (!on) return null;
    const base = slotOf(person?.base);
    return base && typeof base.at === 'string' && base.at ? base : null;
}

/** The planner's view of a movable person with a base: where = the base, routine = the base's routine. Unchanged without one. */
export function basedView(view, person, on) {
    const base = baseOf(person, on);
    if (!base) return view;
    return { ...view, where: base.at, routine: base.routine || `staying at ${base.at}` };
}

/** Whether the planner's `move` ({ key, where }) may stand: a person with a base is not moved away from it. */
export function keepsBase(person, move, on) {
    const base = baseOf(person, on);
    return !base || !move?.where || samePlace(move.where, base.at);
}

/** The planner's goal pulls without those of people held at a base (no journey, no goal meeting: E1). */
export function pullsFree(comes, people, on) {
    if (!on) return comes;
    return (Array.isArray(comes) ? comes : []).filter(come => !baseOf(people?.[come?.key], on));
}
