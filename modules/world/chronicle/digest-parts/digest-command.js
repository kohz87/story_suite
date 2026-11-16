// Story Director v2, chronicle part: the digest command that writes the finished days, and the hook that asks for it. Pure apart from the ctx.

import { DIGEST, FOLLOW_MAX, capDays, dayOf, daysOf, digestSettings, entriesByDay, factsOf, makeDigest, notedOf, orderedDays, rangeDays, writtenOf } from '../days.js';
import { calendarFrom } from '../queries.js';
import { toSlot } from '../../../../packages/story-director/src/v2/slot.js';
import { ask, digestOn, isInt, minutesFrom } from './shared-ask.js';
import { daysToWrite, needsDigest } from './write-days.js';

/**
 * `chronicle.digest { at? }` (cause `system`, from the hook): writes the digests of the finished days
 * (see above) and records where it got to. `at`: the chat's length when the hook ran. Refused from a
 * click and while the story time is not set.
 */
export function digestCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'Day digests are written by Story Director itself when a story day ends.');
    if (!digestOn(ctx)) return ctx.fail('REFUSED', 'The day digest is turned off.');
    const at = payload?.at ?? null;
    if (!(at === null || (isInt(at) && at >= 0))) return ctx.fail('INVALID', 'chronicle.digest: "at" must be the chat\'s length (a whole number).');
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    const now = minutesFrom(query);
    if (now === null) return ctx.fail('REFUSED', 'The story time is not set yet, so no day has ended.');
    const today = dayOf(now);
    const settings = digestSettings(ctx.settings);
    const chronicle = ctx.draft('chronicle');
    if (!chronicle.days || typeof chronicle.days !== 'object' || Array.isArray(chronicle.days)) chronicle.days = {};
    const before = writtenOf(chronicle);
    const { from, missing } = daysToWrite(chronicle, today);
    const wanted = day => day < today && ((from === null || day >= from) || missing.includes(day));
    const noted = notedOf(chronicle);
    const byDay = entriesByDay(chronicle);
    const dayOfRev = rangeDays(byDay);
    // Each finished day from its kept entries. A day from before the entries began (a chat older than
    // them: no `noted`, or a day before the first note) is read from the receipts, as before.
    let director = null;
    try { director = typeof ctx.read === 'function' ? ctx.read('director') : null; } catch { director = null; }
    const state = { domains: { director } };
    const plan = [];
    for (const [day, list] of byDay) {
        if (wanted(day)) plan.push({ day, facts: factsOf(list.map(item => item.entry), { state, day, dayOfRev }), src: list.map(item => item.rev) });
    }
    const older = day => !noted || (isInt(noted.from) && day < noted.from);
    if (!noted || (isInt(noted.from) && (from === null || from < noted.from || missing.some(older)))) {
        const walked = ask(query, 'chronicle.dayFacts', { before: today }) ?? { days: [] };
        for (const entry of walked.days ?? []) {
            if (isInt(entry?.day) && wanted(entry.day) && older(entry.day) && !byDay.has(entry.day)) plan.push(entry);
        }
    }
    plan.sort((a, b) => a.day - b.day);
    const calendar = calendarFrom(query);
    const currency = ask(query, 'inventory.currency', {});
    const rev = isInt(ctx.rev) ? ctx.rev : 0;
    const written = [];
    const found = new Set();
    for (const entry of plan) {
        if (!entry.facts || entry.facts.count <= 0) continue;
        found.add(entry.day);
        let date = '';
        try { date = calendar.format(entry.day * 1440, { time: false }); } catch { date = ''; }
        chronicle.days[String(entry.day)] = toSlot(makeDigest(entry.day, entry.facts, { date, currency, made: rev, revs: entry.revs ?? entry.facts.revs ?? [], src: entry.src ?? null }));
        written.push(date || `day ${entry.day}`);
    }
    // A day to write that no receipt is left for (the only reply of that day was deleted): it goes. So
    // does a day that has not ended any more: the clock went back to it or before it (the reply that
    // moved the clock past it was deleted, which takes its move back). Its facts stay, and it is
    // written again when the clock passes it.
    for (const key of Object.keys(chronicle.days)) {
        const day = Number(key);
        if ((wanted(day) && !found.has(day)) || day >= today) delete chronicle.days[key];
    }
    const live = { state, currency };
    for (const [key, change] of Object.entries(capDays(daysOf(chronicle, live), settings))) {
        if (change === null) delete chronicle.days[key];
        else chronicle.days[key] = toSlot(change);
    }
    keepFollowed(chronicle, byDay, today, live);
    // A time skip: this run follows the day turning (not a rewrite after a delete), and the clock's last
    // jump, as the time part settled it just now, was at least the While away threshold.
    const turned = !before || today > before.through;
    const settle = noted?.settle ?? null;
    const skip = Boolean(turned && settle && settle.to === now && isInt(settle.from) && now - settle.from >= settings.skipMinutes);
    chronicle.written = toSlot({ through: today, days: orderedDays(chronicle, { all: true }).map(digest => digest.day), at, skip });
    return {
        summary: written.length ? `Day digest written: ${written.join(', ')}.` : '',
        narrate: false,
        data: { days: [...found].sort((a, b) => a - b), through: today, skip },
    };
}

/**
 * The entries of the finished days after a digest: a whole digest made from its day's entries keeps
 * those it was made from (its `src`), newest days first while FOLLOW_MAX holds, so it follows them
 * (days.daysOf); every other entry of a finished day goes by key (a short day, a day read from the
 * receipts, one the clock went back to after it was written). A whole digest past FOLLOW_MAX stays
 * as the facts stand now, its `src` cleared (written whole, like a short one).
 */
function keepFollowed(chronicle, byDay, today, live) {
    if (!chronicle.dayFacts || typeof chronicle.dayFacts !== 'object') return;
    const keep = new Set();
    let held = 0;
    const followed = daysOf(chronicle, live);
    for (const digest of Object.values(followed).sort((a, b) => b.day - a.day)) {
        if (digest.brief || !Array.isArray(digest.src) || !(digest.day < today)) continue;
        const src = new Set(digest.src);
        const list = (byDay.get(digest.day) ?? []).filter(item => src.has(item.rev));
        if (held + list.length <= FOLLOW_MAX) {
            held += list.length;
            for (const item of list) keep.add(item.key);
            continue;
        }
        const { src: _src, ...frozen } = digest;
        chronicle.days[String(digest.day)] = toSlot(frozen);
    }
    for (const [day, list] of byDay) if (day < today) for (const item of list) if (!keep.has(item.key)) delete chronicle.dayFacts[item.key];
}

/** The hook's part: `[{ type: chronicle.digest, payload: { at } }]` when digests are due, else []. */
export function digestCommands(view) {
    const chronicle = view?.state?.domains?.chronicle;
    if (!chronicle || !digestOn(view)) return [];
    const minutes = view.state.domains.director?.time?.minutes;
    if (!isInt(minutes)) return [];
    const settled = ask(typeof view.query === 'function' ? (name, args) => view.query(name, args) : null, 'time.overdue', {});
    const settledDay = isInt(settled?.minutes) ? dayOf(settled.minutes) : null;
    if (!needsDigest(chronicle, dayOf(minutes), { settledDay })) return [];
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    return [{ type: DIGEST, payload: { at } }];
}
