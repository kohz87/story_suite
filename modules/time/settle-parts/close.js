// Story Director v2, part time: settles the story clock on a draft (closings, recap, check) and summarises the closings.

import { buildRecap, lapseSummary } from '../recap.js';
import { slotValue, toSlot } from '../../rpg/slot.js';
import { LAPSE_OUTCOME, REASONS, claimKey } from './constants.js';
import { isInt } from './shared-int.js';
import { recapStale } from './needs.js';
import { standing } from './standing.js';

// What the receipt tells about a closed thread (before it closed).
function closedEntry(thread, reason) {
    const fields = thread.fields ?? {};
    return {
        id: thread.id, key: thread.key, kind: thread.kind, reason,
        on: String(fields.on || fields.due || ''), giver: String(fields.giver ?? ''), due: String(fields.due ?? ''),
    };
}

/**
 * Settles the story clock on `director` (a draft): closes what time ran past (each under its
 * claim), marks what is overdue and due, makes or clears the While away recap, and records
 * the check. `claim(key)` takes a claim (false when it is already taken); `within(id)` is told each
 * thread it closes (the command marks its writes there, ctx.ifThere). Returns
 * `{ closed, standing, recap, from, now }`.
 */
export function settle(director, { calendar, settings, rev, at = null, claim, within = () => {}, met = () => false, fights = true }) {
    const now = director.time.minutes;
    const before = slotValue(director.checked);
    const from = isInt(before?.minutes) ? before.minutes : null;
    const plan = standing(director, { calendar, now, met, lapse: settings.lapses });
    const closed = [];
    for (const { id, reason } of plan.lapses) {
        const thread = director.threads[id];
        if (!thread || thread.status !== 'active') continue;
        if (!claim(claimKey(id))) continue;
        within(id);
        closed.push(closedEntry(thread, reason));
        thread.status = 'resolved';
        thread.offer = false;
        thread.ended = { rev, reason, outcome: LAPSE_OUTCOME };
        thread.rev = rev;
        // The tracker's own bookkeeping of when a thread closed (its reply count and the time).
        thread.track = { ...(thread.track ?? {}), closed: { turn: director.turn?.n ?? null, time: now } };
    }

    // The recap: a new one when the clock moved, else the one there was until a later reply.
    let recap = slotValue(director.recap);
    if (from !== now) recap = null;
    else if (recapStale(recap, { at, rev })) recap = null;
    if (from !== null && from !== now) {
        const built = buildRecap(director, { calendar, from, to: now, minMinutes: settings.recapHours * 60, fights });
        if (built) recap = { fromMinutes: from, toMinutes: now, lines: built.lines, threads: built.threads, rev, at };
    }
    // Both are slots (../slot.js): written whole, so a later settle never depends on an earlier one.
    if (recap !== null || director.recap !== undefined) director.recap = toSlot(recap);

    const lapsed = closed.map(entry => entry.id);
    director.checked = toSlot({ minutes: now, rev, lapsed, overdue: plan.overdue, pay: plan.pay, due: plan.due });
    return { closed, standing: plan, recap, from, now };
}

/** The settle receipt's summary for `closed` ('' when nothing closed). */
export function settleSummary(closed, { calendar, now }) {
    return lapseSummary(closed, { calendar, now, reasons: REASONS });
}
