// Story Director v2, part time: whether a recap is stale and whether a settle has anything to do.

import { slotValue } from '../../../packages/story-director/src/v2/slot.js';
import { isInt } from './shared-int.js';
import { standing } from './standing.js';

/**
 * Whether the recap was made for an earlier reply than the one about to be written: the chat
 * has grown by a reply since (`at`, the chat's length now), else (no length known) a later
 * receipt was committed (`rev`, meta.rev now).
 */
export function recapStale(recap, { at = null, rev = null } = {}) {
    if (!recap) return false;
    if (isInt(at) && isInt(recap.at)) return at >= recap.at + 2;
    if (isInt(rev) && isInt(recap.rev)) return rev > recap.rev;
    return false;
}

/** Whether `time.settle` has anything to do on `state` (the beforeGenerate check). */
export function needsSettle(state, { calendar, settings, at = null, met = () => false } = {}) {
    const director = state?.domains?.director;
    const now = director?.time?.minutes;
    if (!director || !isInt(now)) return false;
    const checked = slotValue(director.checked);
    if (!checked || checked.minutes !== now) return true;
    if (recapStale(slotValue(director.recap), { at, rev: state?.meta?.rev ?? null })) return true;
    if (!settings?.lapses) return false;
    const claims = state?.meta?.claims ?? {};
    return standing(director, { calendar, now, met, claimed: key => Boolean(claims[key]) }).lapses.length > 0;
}
