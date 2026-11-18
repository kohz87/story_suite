// Story Director v2, tracker part: the story clock set from a start date (MODULES §F21,
// Story Block's query `packs.calendar` → `{ pack, era, months, start }`; in pack format 4 the start is the selected world's `start.date`,
// read on the game's calendar, which a chat with a frame takes from the frame: time-parts/calendar.js).
//
// A chat whose story has not set the time yet, with a start (`{ year, month, day, hour, minute }`), starts on that date: before the reply is written the
// hook commits `director.seed` as a `system` receipt, so deadlines, beats and events on dates work
// from the first reply. Once per line of history (claim `clock:seed`); the story's own `~ time`
// line moves it from there as usual. Nothing happens when the date is not on the chat's calendar
// (the reader chose their own calendar without the game's months).

import { SEED_CLAIM, calendarOf, packCalendarOf, settingsFrom, startMinutes } from './time.js';

export const SEED = 'director.seed';

const settingsOf = source => settingsFrom(typeof source === 'function' ? source() : source);

function fail(ctx, code, message) {
    ctx.fail(code, message);
    // ctx.fail throws; this is only for a ctx that does not.
    const error = new Error(message);
    error.code = code;
    throw error;
}

/** The id of the selected world (the start date is its), or null: no world, or no packs part. */
function worldIdOf(query) {
    try {
        const picked = typeof query === 'function' ? query('packs.selected', {}) : null;
        return typeof picked?.world === 'string' && picked.world ? picked.world : null;
    } catch {
        return null;
    }
}

/** Where a seed would set the clock: `{ minutes, calendar, pack }` (`pack`: the packs calendar answer), or null when there is nothing to seed. */
export function seedFor(director, settings, query) {
    if (!director || Number.isInteger(director.time?.minutes)) return null;
    const pack = packCalendarOf(query);
    if (!pack?.start) return null;
    const calendar = calendarOf(settings, pack);
    const minutes = startMinutes(calendar, pack.start);
    return minutes === null ? null : { minutes, calendar, pack, from: worldIdOf(query) ?? pack.pack ?? null };
}

/** `director.seed` (cause `system`, from the hook; payload `{}`): the clock set to the pack's start. */
export function seedCommand(ctx) {
    const director = ctx.draft('director');
    if (Number.isInteger(director.time?.minutes)) fail(ctx, 'REFUSED', 'The story time is already set.');
    const seed = seedFor(director, settingsOf(ctx.settings), ctx.query);
    if (!seed) fail(ctx, 'REFUSED', 'No world gives a start date on this calendar.');
    if (!ctx.claim(SEED_CLAIM)) fail(ctx, 'CLAIMED', 'The story clock was already set from the start date.');
    director.time.minutes = seed.minutes;
    return {
        summary: `Story time: ${seed.calendar.format(seed.minutes)} (the start of ${seed.from ?? 'the pack'}).`,
        // The Director note gives the time every reply; nothing to narrate.
        narrate: false,
        data: { minutes: seed.minutes, pack: seed.from },
    };
}

/** `beforeGenerate(view)`: `{ commands: [director.seed] }` while the clock is unset and a pack has a start. */
export function seedHook(view) {
    const state = view?.state;
    const director = state?.domains?.director;
    if (!director || Number.isInteger(director.time?.minutes)) return undefined;
    if (Object.hasOwn(state?.meta?.claims ?? {}, SEED_CLAIM)) return undefined;
    if (!seedFor(director, settingsOf(view.settings), view.query)) return undefined;
    return { lines: [], commands: [{ type: SEED, payload: {} }] };
}
