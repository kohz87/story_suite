// What the hosted slice does with a held event: the day rule, the story-clock readers, the reader's words for the receipt and the cut of a forwarded change to a lower tier.
import { RELATIONSHIP_KEYS, RELATIONSHIP_MILESTONE_REQUIREMENTS, RELATIONSHIP_MILESTONE_THRESHOLDS } from '../../core-relationship-model.js';
import { DAY_MINUTES } from '../npc-meters-config.js';
import { PACING_TIERS } from '../relationship-pacing.js';

const list = words => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]);

/**
 * The day rule (1: a meter line is judged on the story time in effect at that line, so a `~ time` of the same reply counts; 0: on the minute
 * before the reply, as replies read before this rule did). A first read is 1; a Re-read keeps what the reply's earlier read used: 1 only when
 * its receipt for this person carries `dayRule: 1` (result data).
 */
export const dayRuleFor = (ctx, key) => (!ctx?.standing || (Array.isArray(ctx.standingReceipts) && ctx.standingReceipts.some(item => item?.data?.key === key && item.data.dayRule === 1)) ? 1 : 0);

/**
 * The clock readers of one npc part: `now` is the story minute in effect at the line (the day rule); without it, the minute before the reply
 * (hooks.startTime). clockDay is null without a clock or when Delta owns the calendar; dateOf is the dossier's words for that day ('' without).
 */
export function clockReaders(hooks, call) {
    const clockMinutes = (at, now = null) => (call(hooks.calendarOwn, false) === true ? null : Number.isInteger(now) ? now : (m => (Number.isInteger(m) ? m : null))(call(hooks.startTime, null, at)));
    const clockDay = (at, now = null) => { const minutes = clockMinutes(at, now); return minutes === null ? null : Math.floor(minutes / DAY_MINUTES); };
    const dateOf = (at, now = null) => (clockDay(at, now) === null ? '' : Number.isInteger(now) ? call(hooks.dateAt, '', now) : call(hooks.startDate, '', at));
    return { clockMinutes, clockDay, dateOf };
}

/** The reader's words for a held event ('' when it counted as asked): "major counted as meaningful: today's major is used". */
export function pacingNote(tier, used, skipped, date = '', day = null) {
    if (!skipped.length || used === tier) return '';
    const when = date || (Number.isInteger(day) ? `story day ${day + 1}` : '');
    const full = `today's ${list(skipped)} ${skipped.length > 1 ? 'are' : 'is'} used${when ? ` on ${when}` : ''}`;
    return used ? `${tier} counted as ${used}: ${full}` : full;
}

/**
 * A scanner change already weighed at its asked tier (`changes`: [{ meter, value }] nets), cut down to what `used` allows:
 * each step within that tier's points, and no built-in relationship step across a gate needing a higher tier than `used`
 * (it stops on the gate). `value(meter)` reads the meter's value now. → the cut changes.
 */
export function cutToTier(changes, used, caps, value) {
    const rank = name => PACING_TIERS.indexOf(name);
    return changes.map(change => {
        const before = value(change.meter);
        let step = Math.max(-caps[used], Math.min(caps[used], change.value));
        const sign = Math.sign(step);
        if (RELATIONSHIP_KEYS.includes(change.meter) && sign && (before === 0 || Math.sign(before) === sign)) {
            for (const gate of RELATIONSHIP_MILESTONE_THRESHOLDS) {
                if (rank(RELATIONSHIP_MILESTONE_REQUIREMENTS[gate]) <= rank(used)) continue;
                if (Math.abs(before) <= gate && Math.abs(before + step) > gate) step = sign * (gate - Math.abs(before));
            }
        }
        return { ...change, value: step };
    });
}
