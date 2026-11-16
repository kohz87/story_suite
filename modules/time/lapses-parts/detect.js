// Story Director: detecting slipped beats and lapsed offers from tracker state.
import { isOffer } from '../tracker.js';
import { SLIP_GRACE_DAYS, UNDATED_OFFER_DAYS } from './constants.js';
import { dateEnd, isNumber } from './shared-dates.js';

// A `!` since the date was last written is the beat played out: `! Key — …` alone clears the
// date, but one with parts (`! Key — the riders come | now: at the ford`) keeps it. A line that
// writes the date again (`~ Key — on: Goldwane 20`, `! Key — … | on: …`) puts it back on the
// schedule. Only the history the record keeps is read; with no line writing the date left in
// it, any `!` counts as fired.
const WRITES_DATE = /(?<![\p{L}\p{N}])(?:on|due)\s*:/iu;
function firedSinceDated(record) {
    for (const entry of [...(record.history ?? [])].reverse()) {
        const text = String(entry?.text ?? '');
        if (entry?.op === '+' || WRITES_DATE.test(text)) return false;
        if (entry?.op === '!') return true;
    }
    return false;
}

/**
 * The open beats whose date (`on`, else `due`) passed more than `graceDays` story days ago
 * without the story firing them, in tracker order: the records to close as slipped. A date
 * without a time counts to the end of its day. Nothing without a calendar, a time or a date.
 */
export function slippedBeats(tracker, { calendar, now, graceDays = SLIP_GRACE_DAYS } = {}) {
    if (!calendar || !isNumber(now)) return [];
    const grace = Number(graceDays) >= 0 ? Number(graceDays) : SLIP_GRACE_DAYS;
    return (tracker?.records ?? []).filter(record => {
        if (record?.kind !== 'beat' || record.status !== 'active') return false;
        const end = dateEnd(record, 'on', { calendar, now }) ?? dateEnd(record, 'due', { calendar, now });
        if (end === null || calendar.addDays(end, grace) >= now) return false;
        return !firedSinceDated(record);
    });
}

// An offer with no deadline written at all (a deadline that cannot be read stays as it was).
const isUndated = record => !String(record?.fields?.due ?? '').trim();

/**
 * The story minute an offer (tracker.isOffer) closes as lapsed, or null: it is no offer, or its deadline cannot be read, or it has
 * no time to count from. The same rule lapsedOffers closes by, so a date shown is the date it closes (`now` only resolves a
 * year-less date).
 */
export function lapseTime(record, { calendar, now, graceDays = SLIP_GRACE_DAYS, undatedDays = UNDATED_OFFER_DAYS } = {}) {
    if (!calendar || !isNumber(now) || !isOffer(record)) return null;
    const grace = Number(graceDays) >= 0 ? Number(graceDays) : SLIP_GRACE_DAYS;
    if (isUndated(record)) {
        const span = Number(undatedDays) >= 0 ? Number(undatedDays) : UNDATED_OFFER_DAYS;
        const times = [record.created?.time, record.seen?.time, record.engaged?.time].filter(isNumber);
        return times.length ? calendar.addDays(Math.max(...times), span) : null;
    }
    const end = dateEnd(record, 'due', { calendar, now });
    if (end === null) return null;
    return record.engaged ? calendar.addDays(end, grace) : end;
}

/**
 * The offers (jobs not taken on, tracker.isOffer) whose deadline (`due`) has passed, in tracker
 * order: the records to close as lapsed. A deadline without a time runs to the end of its day,
 * and is passed at that minute, as the Quests tab marks it overdue. (0.9.27) An offer the reader
 * has spoken of (`engaged`) is often the job's own day ("the hunt sets out on Goldwane 15"), so
 * it gets a beat's grace, `graceDays` more, for the story to play it. An offer with no deadline
 * lapses `undatedDays` (UNDATED_OFFER_DAYS) story days after it was offered or last mentioned.
 */
export function lapsedOffers(tracker, { calendar, now, graceDays = SLIP_GRACE_DAYS, undatedDays = UNDATED_OFFER_DAYS } = {}) {
    if (!calendar || !isNumber(now)) return [];
    return (tracker?.records ?? []).filter(record => {
        const at = lapseTime(record, { calendar, now, graceDays, undatedDays });
        return at !== null && at <= now;
    });
}
