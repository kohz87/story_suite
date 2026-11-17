// Story Director v2, chronicle part: `apply` for `world` lines. With the switch `story-director.world-events` off it is the plain line
// (apply-line.js, untouched); on, a reply may carry one world line, and its `conditions:` label sets and lifts the world's conditions.

import { cleanName, findIn } from '../../domain.js';
import { CLEAR, asText, labelOf } from '../text.js';
import { applyPlainWorldLine } from './apply-line.js';
import { applyConditions, claimReply, readConditions } from './conditions.js';
import { worldEventsOn } from './switch.js';

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
    if (name && !claimReply(ctx, ctx.draft('chronicle'))) {
        return ctx.fail('REFUSED', `A reply may carry one world line; "${name}" was not used.`);
    }
    const result = applyPlainWorldLine(ctx, line);
    if (!items.length) return result;
    const found = findIn(ctx.draft('chronicle').events, name);
    const event = found ? ctx.draft('chronicle').events[found.id] : null;
    const place = placeOf(labels, ['place', 'where', 'at', 'near']) || event?.place || '';
    const why = asText(line?.text).trim().slice(0, 160) || name;
    const { done, notes } = applyConditions(ctx, items, { place, region: placeOf(labels, ['region', 'realm']), why });
    const text = [done.length ? `Conditions: ${done.join(', ')}.` : '', notes.length ? `Not used: ${notes.join('; ')}.` : ''].filter(Boolean).join(' ');
    return text ? { ...result, summary: `${result.summary} ${text}`, data: { ...result.data, ...(done.length ? { conditions: done } : {}) } } : result;
}
