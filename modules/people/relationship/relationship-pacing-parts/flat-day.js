// The stored per-day count record (nested and flat): its validity checks and the flat conversions.
import { PACING_TIERS, isInt } from './shared-tiers.js';

/** Problems with a stored `impactDay` ([] when fine). */
export function impactDayProblems(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ['is not a record'];
    const errors = [];
    if (!isInt(value.day)) errors.push('has no whole story day');
    if (!(typeof value.reply === 'string' ? value.reply.length > 0 && value.reply.length <= 120 : isInt(value.reply) && value.reply >= 0)) errors.push('has no reply');
    for (const tier of PACING_TIERS) if (!isInt(value[tier]) || value[tier] < 0 || value[tier] > 1000) errors.push(`has an unusable count of ${tier} events`);
    for (const key of Object.keys(value)) if (key !== 'day' && key !== 'reply' && !PACING_TIERS.includes(key)) errors.push(`has an unknown field "${key}"`);
    return errors;
}

// On the hosted slice the same record is stored FLAT, with the day in every key: { reply, 'd12:ordinary': 1, 'd12:meaningful': 0, ... }.
// Story Block replays stored ops, and an op holds only the fields that changed (Story_block src/v2/ops/diff.js), so a `day` field
// that did not change would be missing from a later event's op and a surviving event could be counted on the day before. A key that
// names its day carries it in whatever op wrote it. Spending and reading use ONLY the keys of the day in force (the story day before
// the reply, which the caller gives): never "the newest day named", so a clock that went back, or a key left over from a deleted
// event, cannot select a stale day. A write stores the current day's four keys as the whole record, so every key the writer saw is
// dropped with it (the diff removes what it saw). Keys of another day that a replay left behind after repeated deletes are never read
// and go at the next write: a few of them are harmless (they only take room; flatDayProblems accepts them).
const FLAT_KEY = /^d(-?\d{1,9}):(ordinary|meaningful|major|extreme)$/;

/** The flat record of a spendEvent `next` ({ day, reply, counts }): every tier's count for that day, and the reply. */
export function toFlatDay(next) {
    return { reply: next.reply, ...Object.fromEntries(PACING_TIERS.map(tier => [`d${next.day}:${tier}`, next[tier]])) };
}

/** A stored flat record as spendEvent reads it ({ day, reply, counts }) for `day` only; a missing key is zero. null: none, or unusable. */
export function fromFlatDay(value, day) {
    if (!isInt(day) || !value || typeof value !== 'object' || flatDayProblems(value).length) return null;
    return { day, reply: value.reply, ...Object.fromEntries(PACING_TIERS.map(tier => [tier, value[`d${day}:${tier}`] ?? 0])) };
}

/** Problems with a stored flat record ([] when fine). */
export function flatDayProblems(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ['is not a record'];
    const errors = [];
    if (value.reply !== undefined && !(typeof value.reply === 'string' ? value.reply.length > 0 && value.reply.length <= 120 : isInt(value.reply) && value.reply >= 0)) errors.push('has no reply');
    for (const [key, count] of Object.entries(value)) {
        if (key === 'reply') continue;
        if (!FLAT_KEY.test(key)) errors.push(`has an unknown field "${key}"`);
        else if (!isInt(count) || count < 0 || count > 1000) errors.push(`has an unusable count in "${key}"`);
    }
    return errors;
}
