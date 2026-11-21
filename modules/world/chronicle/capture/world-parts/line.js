// Story Director v2, chronicle part: `apply` for `world` lines. With the switch `story-director.world-events` off it is the plain line
// (apply-line.js, untouched); on, a world line's `conditions:` label sets and lifts the world's conditions, one such line per reply.

import { cleanName, findIn } from '../../domain.js';
import { CLEAR, asText, labelOf } from '../text.js';
import { applyPlainWorldLine } from './apply-line.js';
import { applyConditions, claimReply, readConditions } from './conditions.js';
import { worldEventsOn } from './switch.js';
import { markForJudge } from './judge-mark.js';

const placeOf = (labels, names) => {
    const value = labelOf(labels, names);
    return value === undefined || CLEAR.test(asText(value).trim()) ? '' : cleanName(value);
};

/** `apply(ctx, line)` for `world` lines. */
export function applyWorldLine(ctx, line) {
    if (!worldEventsOn(ctx)) return applyPlainWorldLine(ctx, line);
    const labels = line?.labels && typeof line.labels === 'object' ? line.labels : {};
    const wanted = labelOf(labels, ['conditions', 'condition']);
    const items = wanted === undefined ? [] : readConditions(wanted);
    const name = cleanName(line?.name);
    // One world line with conditions per reply (seam audit E38: the cap is only for lines that carry `conditions:`).
    if (items.length && name && !claimReply(ctx, ctx.draft('chronicle'))) {
        return ctx.fail('REFUSED', `A reply may carry one world line with conditions; "${name}" was not used.`);
    }
    const result = applyPlainWorldLine(ctx, line);
    // A new entry from the story's line waits for the Director's verdict while the chronicle's `judge` setting is on (judge-mark.js).
    const fresh = result?.data?.created === true && typeof result.data.event === 'string' ? result.data.event : null;
    if (!items.length) return fresh && markForJudge(ctx, ctx.draft('chronicle'), fresh) ? waiting(result) : result;
    const found = findIn(ctx.draft('chronicle').events, name);
    const event = found ? ctx.draft('chronicle').events[found.id] : null;
    const place = placeOf(labels, ['place', 'where', 'at', 'near']) || event?.place || '';
    const why = asText(line?.text).trim().slice(0, 160) || name;
    const { done, notes } = applyConditions(ctx, items, { place, region: placeOf(labels, ['region']), realm: placeOf(labels, ['realm']), why });
    const marked = fresh ? markForJudge(ctx, ctx.draft('chronicle'), fresh, done) : false;
    const text = [done.length ? `Conditions: ${done.join(', ')}.` : '', notes.length ? `Not used: ${notes.join('; ')}.` : ''].filter(Boolean).join(' ');
    const out = text ? { ...result, summary: `${result.summary} ${text}`, data: { ...result.data, ...(done.length ? { conditions: done } : {}) } } : result;
    return marked ? waiting(out) : out;
}

// The receipt of a line whose entry waits for the Director: its data marks it (the summary stays the line's: the day digest reads it).
const waiting = result => ({ ...result, data: { ...result.data, judge: 'pending' } });
