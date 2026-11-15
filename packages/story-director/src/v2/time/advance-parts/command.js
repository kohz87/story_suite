// The `director.advance` command: the story clock moved on by another module's rule.

import { calendarOf, timeSettings } from '../records.js';
import { advanceClaim, spanText } from './helpers.js';

export const ADVANCE = 'director.advance';
export const MAX_ADVANCE = 1440;
const CAUSE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const MAX_REASON = 120;

const isInt = value => Number.isSafeInteger(value);

function fail(ctx, code, message) {
    ctx.fail(code, message);
    // ctx.fail throws; this is only for a ctx that does not.
    const error = new Error(message);
    error.code = code;
    throw error;
}

// Plain words: one line, invisible marks gone, cut by code points.
function words(value) {
    const flat = String(value ?? '').replace(/[\p{Cf}\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim();
    const chars = Array.from(flat);
    return chars.length <= MAX_REASON ? flat : `${chars.slice(0, MAX_REASON - 1).join('').trimEnd()}…`;
}


/** `director.advance { minutes, cause?, reason? }` (see above). */
export function advanceCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') fail(ctx, 'REFUSED', 'Story time moves with the story: write it in the reply, or let the rules that take time move it.');
    const asked = payload?.minutes;
    if (!isInt(asked) || asked < 1) fail(ctx, 'INVALID', 'director.advance: "minutes" must be a whole number of story minutes, 1 or more.');
    const label = payload?.cause ?? ctx?.caller ?? 'system';
    const cause = String(label).trim().toLowerCase();
    if (!CAUSE.test(cause)) fail(ctx, 'INVALID', 'director.advance: "cause" must be a short label (letters, digits, ".", "_", "-"; at most 40).');
    const reason = words(payload?.reason);
    const director = ctx.draft('director');
    const before = director?.time?.minutes;
    if (!isInt(before)) fail(ctx, 'REFUSED', 'The story time is not set yet, so it cannot move on.');
    const calendar = calendarOf(timeSettings(ctx.settings));
    const why = reason || cause;
    const claim = advanceClaim(cause, ctx.carrier?.sid ?? null);
    if (claim && !ctx.claim(claim)) {
        return {
            summary: `Story time stays at ${calendar.format(before)}: the clock already moved for ${cause} in this reply (${why}).`,
            narrate: false,
            data: { minutes: before, from: before, advanced: 0, cause, reason, held: 'once' },
            problem: `The clock moves once a reply for ${cause}; "${why}" did not move it again.`,
        };
    }
    const minutes = Math.min(asked, MAX_ADVANCE);
    const next = before + minutes;
    if (!isInt(next)) fail(ctx, 'INVALID', 'That is further on than the story clock can count.');
    director.time.minutes = next;
    const held = minutes < asked;
    return {
        summary: `Story time: ${calendar.format(next)} (${spanText(minutes)} on: ${why}).`,
        narrate: false,
        data: { minutes: next, from: before, advanced: minutes, cause, reason, ...(held ? { asked } : {}) },
        ...(held ? { problem: `${why}: ${spanText(asked)} asked; the clock moves at most a day (${spanText(MAX_ADVANCE)}) at once.` } : {}),
    };
}
