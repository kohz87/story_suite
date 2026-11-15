// Spending one paced event against a day's allowance, on the nested record or the slice's flat record.
import { PACING_TIERS, isInt, pacedTier } from './shared-tiers.js';
import { impactDayProblems, toFlatDay, fromFlatDay } from './flat-day.js';

/**
 * One event of `tier` for the NPC whose record holds `prior` (its stored impactDay, if any).
 *   reply     the reply the event belongs to (null: nothing is paced)
 *   clockDay  the story day now as a whole number (null: no story clock, so no limit: nothing is counted)
 *   allowance normalizeAllowance's answer (null: no limit)
 * → { used, next, skipped }: `used` the tier the event counts as (null: none has room, it moves nothing); `next` the
 *   impactDay to store (null: leave the record as it is); `skipped` the tiers that were full, lowest first.
 */
export function spendEvent(prior, { tier, reply, clockDay, allowance }) {
    const unpaced = !allowance || !isInt(clockDay) || reply === null || reply === undefined;
    if (!pacedTier(tier) || unpaced) return { used: pacedTier(tier), next: null, skipped: [] };
    const stored = prior && typeof prior === 'object' && !impactDayProblems(prior).length ? prior : null;
    const same = stored && stored.reply === reply;
    const day = same ? stored.day : clockDay;
    const counts = Object.fromEntries(PACING_TIERS.map(name => [name, stored && stored.day === day ? stored[name] : 0]));
    const skipped = [];
    let used = null;
    for (let at = PACING_TIERS.indexOf(tier); at >= 0; at -= 1) {
        const name = PACING_TIERS[at];
        const room = allowance[name];
        if (room === null || room === undefined || counts[name] < room) { used = name; break; }
        skipped.unshift(name);
    }
    // Unlimited tiers can be used indefinitely; keep their persisted count valid and still above every finite allowance.
    if (used) counts[used] = Math.min(1000, counts[used] + 1);
    return { used, next: { day, reply, ...counts }, skipped };
}

/** spendEvent for the slice's flat record: `prior` is the stored flat record (read for `args.clockDay` only), `next` the flat record to store. */
export function spendFlatEvent(prior, args) {
    const spent = spendEvent(fromFlatDay(prior, args.clockDay), args);
    return spent.next ? { ...spent, next: toFlatDay(spent.next) } : spent;
}
