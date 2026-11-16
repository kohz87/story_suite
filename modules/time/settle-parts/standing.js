// Story Director v2, part time: where the active threads stand at a story time (lapsed, overdue, pay, due).

import { LAPSED_REASON, SLIPPED_REASON, SLIP_GRACE_DAYS, lapsedOffers, slippedBeats } from '../lapses.js';
import { isDue } from '../../atlas/relevance.js';
import { waitsForPay } from '../tracker/tracker.js';
import { trackerOf } from '../records.js';
import { DEADLINE_REASON, claimKey } from './constants.js';
import { isInt } from './shared-int.js';

// The last minute a date counts for: a date without a time runs to the end of its day, the
// way v1 counts deadlines (lapses.js, the Quests tab).
function deadlineEnd(record, calendar, now) {
    const written = String(record?.fields?.due ?? '').trim();
    if (!written) return null;
    const parsed = calendar.parse(written, { reference: now });
    if (!parsed || !Number.isFinite(parsed.abs)) return null;
    return parsed.hasTime ? parsed.abs : calendar.addDays(parsed.abs, 1) - 1;
}

/**
 * Where the active threads stand at story time `now`, in tracker order:
 * `{ lapses: [{ id, reason }], overdue: [id], pay: [id], due: [id] }`.
 * `met(id)`: the quest's target is met (only its turn-in waits). `claimed(key)`: a claim is
 * already taken (those threads are not lapsed again). `lapse: false` closes nothing: what would
 * have closed is overdue (a quest or offer) or due (a beat).
 */
export function standing(director, { calendar, now, met = () => false, claimed = () => false, lapse = true, graceDays = SLIP_GRACE_DAYS } = {}) {
    const out = { lapses: [], overdue: [], pay: [], due: [] };
    if (!director || !calendar || !isInt(now)) return out;
    const { tracker, threadOf } = trackerOf(director, { calendar, now });
    const options = { calendar, now, graceDays };
    const slipped = new Set(slippedBeats(tracker, options));
    const lapsed = new Set(lapsedOffers(tracker, options));
    for (const record of tracker.records) {
        const thread = threadOf.get(record);
        // A quest is the story's (overdue, then failed below, once taken on). An offer not yet taken is a job
        // offered: a line that touched it (`~ Key | now: …`) reads its kind as a quest, but it still lapses.
        if (thread.rpg || (thread.kind === 'quest' && !(thread.offer && !thread.taken))) continue;
        const id = thread.id;
        const closes = reason => {
            if (lapse && !claimed(claimKey(id))) out.lapses.push({ id, reason });
            else if (reason === SLIPPED_REASON) out.due.push(id);
            else out.overdue.push(id);
        };
        if (record.kind === 'secret') continue;
        if (slipped.has(record)) {
            closes(SLIPPED_REASON);
            continue;
        }
        if (lapsed.has(record)) {
            // An offer with no deadline has nothing to be overdue of: it only closes (or, with
            // lapses off or its claim taken, stays as it is).
            if (String(record.fields.due ?? '').trim()) closes(LAPSED_REASON);
            else if (lapse && !claimed(claimKey(id))) out.lapses.push({ id, reason: LAPSED_REASON });
            continue;
        }
        const job = Boolean(thread.taken || thread.offer);
        if (!job) {
            if (isDue(record, { calendar, now })) out.due.push(id);
            continue;
        }
        const end = deadlineEnd(record, calendar, now);
        if (end === null || end > now) continue;
        // An offer still within its grace (the reader spoke of it): overdue, not lapsed yet.
        if (thread.offer && !thread.taken) {
            out.overdue.push(id);
            continue;
        }
        if (waitsForPay(record) || met(id)) out.pay.push(id);
        else if (calendar.addDays(end, graceDays) < now) closes(DEADLINE_REASON);
        else out.overdue.push(id);
    }
    return out;
}
