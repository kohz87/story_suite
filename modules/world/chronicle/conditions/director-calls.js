// The count of Director calls this game year, for Settings (read only; switch story-director.world-events): the open templates' calls (the world ledger's
// `open.yearCalls`, which belongs to one game year and counts from nothing in the next), the world judge's (`judged.yearCalls`) plus the arc judge's calls (kept on each arc, by the year the arc
// began in). 0 when none is kept. Pure on the state and the calendar.

import { isInt } from '../domain-parts/shared-basics.js';
import { slotValue } from '../../../rpg/slot.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';
import { setup } from '../queries-parts/env.js';
import { judgedCalls } from '../world-judge/calls.js';

/** The game year of `minutes` on the calendar (null when it is not a whole number or the calendar cannot say). */
export function yearOf(calendar, minutes) {
    if (!isInt(minutes)) return null;
    try { return calendar.fromAbs(minutes).year; } catch { return null; }
}

/** `chronicle.directorCalls` → `{ count }` (a whole number, 0 when none is kept), null while the switch is off. */
export const directorCallsQuery = Object.assign((state, _args, tools) => {
    const { calendar, now } = setup(state, tools);
    const year = yearOf(calendar, now);
    const open = slotValue(state?.domains?.chronicle?.ledger)?.open;
    let count = year !== null && open?.year === year && isInt(open.yearCalls) && open.yearCalls > 0 ? open.yearCalls : 0;
    // The Director judge's calls on world entries and on the daily roll (world-judge/calls.js).
    count += judgedCalls(state?.domains?.chronicle?.ledger, year);
    for (const arc of Object.values(state?.domains?.arc?.arcs ?? {})) {
        if (year !== null && yearOf(calendar, arc?.minutes) === year && isInt(arc?.judge?.calls)) count += arc.judge.calls;
    }
    return { count };
}, { feature: WORLD_EVENTS_FEATURE });
