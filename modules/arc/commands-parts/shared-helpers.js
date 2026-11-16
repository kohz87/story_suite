// Shared validation, revision, and plan-option helpers for arc commands.

import { makeCalendar } from '../../time/calendar.js';

export function fail(ctx, code, message) {
    ctx.fail(code, message);
    const error = new Error(message);
    error.code = code;
    throw error;
}

export const revOf = ctx => (Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0);
export const has = (object, key) => Boolean(object) && Object.hasOwn(object, key);

// The chat's calendar (the tracker's `director.calendar`), or null without one.
function calendarOf(ctx) {
    try {
        const config = ctx.query?.('director.calendar', {});
        return config && typeof config === 'object' ? makeCalendar(config) : null;
    } catch {
        return null;
    }
}

export function planOptions(ctx, director, extra = {}) {
    const minutes = director?.time?.minutes;
    return { calendar: calendarOf(ctx), now: Number.isSafeInteger(minutes) ? minutes : null, fights: ctx.fights !== false, ...extra };
}
