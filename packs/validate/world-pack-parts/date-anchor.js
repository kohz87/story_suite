// The job: checking the two newer anchors: a fixed date `date:<year>-<month>-<day>` (spec v0.14.3) and `arc-ended:<template id>@<ref>` (v0.14).
// `ctx.index.calendar` is the pack's own calendar (or null: the built-in Gregorian one is assumed, and a doubt is a warning).

import { foldKey } from '../../../core/text.js';

export const GREGORIAN = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    .map((name, n) => ({ name, days: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][n] })));

/** `612-07-30`, `612-Goldwane-12` → true when it reads (a year, a month by number or name, a day); says the Problem or warns otherwise. */
export function checkDate(id, text, ctx, field) {
    const match = /^(\d+)-([^-]+)-(\d+)$/.exec(id);
    if (!match) return ctx.say(field, `"${text}": a fixed date is date:<year>-<month>-<day>, like date:612-07-30 or date:612-Goldwane-12.`), false;
    // Format 4: the world has no calendar; only the shape is checked here and the paired game pack's calendar decides the rest.
    if (ctx.index.deferCalendar) {
        const [, , month, day] = match;
        if (!(/^\d{1,2}$/.test(month) ? Number(month) >= 1 : /^\p{L}[\p{L}' ]{0,39}$/u.test(month)) || Number(day) < 1 || Number(day) > 999) return ctx.say(field, `"${text}": the month is a number from 1 (or a month name) and the day a number from 1.`), false;
        return true;
    }
    const own = ctx.index.calendar?.months?.length ? ctx.index.calendar.months : null;
    const months = own ?? GREGORIAN;
    const [, , month, day] = match;
    const named = !/^\d+$/.test(month);
    const at = named ? months.findIndex(entry => foldKey(entry.name) === foldKey(month)) : Number(month) - 1;
    if (named && at < 0) {
        if (own) return ctx.say(field, `"${text}": "${month}" is not a month of this pack's calendar (${months.map(entry => entry.name).join(', ')}).`, 'UNKNOWN_REF'), false;
        ctx.collect.warnings.push([field, `"${text}": "${month}" is not a month of the built-in calendar; the game's calendar must have it.`]);
    } else if (!named && (at < 0 || at >= months.length)) ctx.collect.warnings.push([field, `"${text}": the calendar has no month ${month} (it has ${months.length}).`]);
    else if (Number(day) < 1 || Number(day) > months[at].days) ctx.collect.warnings.push([field, `"${text}": ${months[at].name} has ${months[at].days} days, so day ${day} never comes.`]);
    return true;
}

/** `bread-riot@region`: a template of this pack, at a place, region or realm of it (or a placeholder word). */
export function arcEndedKnown(id, text, ctx, field) {
    const cut = id.indexOf('@');
    const name = cut < 0 ? id : id.slice(0, cut);
    const ref = cut < 0 ? '' : id.slice(cut + 1).replace(/^@/, '');
    if (!ref) return ctx.say(field, `"${text}": write arc-ended:<template id>@<place, region or realm>.`), false;
    if (!ctx.index.templateIds.has(name)) return ctx.say(field, `"${text}": "${name}" is not a template of this pack.`, 'UNKNOWN_REF'), false;
    if (!['place', 'region', 'realm'].includes(ref) && !ctx.index.ref(ref).size) return ctx.say(field, `"${text}": "${ref}" is not a place, region or realm of this pack.`, 'UNKNOWN_REF'), false;
    return true;
}
