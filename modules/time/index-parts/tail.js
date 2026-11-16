// The `[While away]` line the reply after a jump is told, in the context tail.

import { estimateTokens } from '../../atlas/relevance.js';
import { RECAP_BUDGET, buildRecap } from '../recap.js';
import { calendarOf, timeSettings } from '../records.js';
import { recapStale } from '../settle.js';
import { slotValue } from '../../../packages/story-director/src/v2/slot.js';
import { ownedKind, threadsOn, withoutOwnedThreads } from '../tracker/threads.js';
import { isInt } from './shared-int.js';

/** The recap the reply about to be written gets, or null. */
function recapFor(view) {
    const recap = slotValue(view?.state?.domains?.director?.recap);
    if (!recap || !Array.isArray(recap.lines)) return null;
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    return recapStale(recap, { at, rev: view?.state?.meta?.rev ?? null }) ? null : recap;
}

// The recap without what the feature `story-director.threads` owns (agendas, events, clocks, beats, secrets), while it is off:
// as it is when it tells none of them, else made again from the threads that are left (the stored recap is not touched).
function recapLines(view, recap) {
    if (threadsOn(view)) return recap.lines;
    const director = view?.state?.domains?.director;
    if (!(Array.isArray(recap.threads) ? recap.threads : []).some(id => ownedKind(director?.threads?.[id]?.kind))) return recap.lines;
    if (!isInt(recap.fromMinutes) || !isInt(recap.toMinutes)) return [];
    const settings = timeSettings(view.settings);
    try {
        return buildRecap(withoutOwnedThreads(director), { calendar: calendarOf(settings), from: recap.fromMinutes, to: recap.toMinutes, minMinutes: settings.recapHours * 60, fights: view?.fights !== false })?.lines ?? [];
    } catch {
        return [];
    }
}

/** `context.tail(view)`: the `[While away] …` line for the reply after the jump. */
export function timeTail(view) {
    const recap = recapFor(view);
    const lines = recap ? recapLines(view, recap).filter(line => typeof line === 'string' && line && estimateTokens(line) <= RECAP_BUDGET) : [];
    return { lines, optional: [] };
}
