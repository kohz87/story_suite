// The settle step of the world conditions: one whose end has come is removed, with a receipt. Deterministic: ordered by key.

import { isInt } from '../domain-parts/shared-basics.js';
import { clockOf } from '../capture/text.js';
import { pointerOf } from './key.js';
import { WORLD_EVENTS_FEATURE, worldEventsOn } from './feature.js';

export const CONDITIONS_SETTLE = 'chronicle.conditions.settle';

/** The keys whose end has come at `now` (fadesAt <= now), in key order. */
// An entry the daily step holds for an Active event (`holds`, world-events switch) is not due whatever its timer says.
export const dueKeys = (table, now) => (isInt(now) && table ? Object.keys(table).filter(key => isInt(table[key]?.fadesAt) && table[key].fadesAt <= now && !table[key].holds?.length).sort() : []);

function settleCommand(ctx) {
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; nothing fades.');
    const chronicle = ctx.draft('chronicle');
    const keys = dueKeys(chronicle.conditions, now);
    const gone = [];
    for (const key of keys) {
        if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', pointerOf(key));
        gone.push(`${chronicle.conditions[key].name} on ${chronicle.conditions[key].ref}`);
        delete chronicle.conditions[key];
    }
    return { summary: gone.length ? `Faded: ${gone.join(', ')}.` : '', narrate: false, data: { faded: keys } };
}

/** The command, tagged with the feature. */
export const settleConditions = Object.assign(settleCommand, { feature: WORLD_EVENTS_FEATURE });

/** `beforeGenerate` part: the settle command when a condition's end has come and the feature is on; nothing otherwise. */
export function conditionsSettleCommands(view) {
    if (!worldEventsOn(view)) return [];
    const now = view?.state?.domains?.director?.time?.minutes;
    return dueKeys(view?.state?.domains?.chronicle?.conditions, now).length ? [{ type: CONDITIONS_SETTLE, payload: {} }] : [];
}
