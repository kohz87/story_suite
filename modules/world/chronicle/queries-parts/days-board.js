// Chronicle queries' day digests as the Journal lists them.

import { digestOut, orderedDays } from '../days.js';
import { ask, toolsQuery } from './shared-ask.js';
import { dateText } from './clock.js';
import { dayArg, substituteOf } from './shared-day-args.js';
import { setup } from './env.js';

/**
 * The day digests kept, oldest first, as `chronicle.days` gives them; `from` and `to` (story day
 * numbers, `time.now`'s `day`, both inclusive) keep a range. Null for an argument that is not a day.
 */
export function daysQuery(state, { from = null, to = null } = {}, tools) {
    const low = dayArg(from);
    const high = dayArg(to);
    if (Number.isNaN(low) || Number.isNaN(high)) return null;
    const currency = ask(toolsQuery(tools), 'inventory.currency', {});
    const substitute = substituteOf(tools);
    return orderedDays(state?.domains?.chronicle, { state, currency })
        .filter(digest => (low === null || digest.day >= low) && (high === null || digest.day <= high))
        .map(digest => digestOut(digest, { currency, substitute }));
}

/**
 * One day as the Journal (and the older Days screen) lists it: the digest (digestOut) with its fact lines,
 * the line without its date, and the text the search box looks in.
 */
export function boardDay(digest) {
    const quests = digest.quests;
    const met = Array.isArray(digest.met) ? digest.met : [];
    const facts = [
        digest.places.length ? `Went to: ${digest.places.join(', ')}` : '',
        quests.taken.length ? `Took on: ${quests.taken.join(', ')}` : '',
        quests.done.length ? `Finished: ${quests.done.join(', ')}` : '',
        quests.failed.length ? `Failed: ${quests.failed.join(', ')}` : '',
        quests.dropped.length ? `Gave up: ${quests.dropped.join(', ')}` : '',
        digest.fightText ? `Fights: ${digest.fightText}` : '',
        digest.moneyText ? `Money: ${digest.moneyText}` : '',
    ].filter(Boolean);
    const search = [digest.date, digest.line, ...digest.happened, ...digest.places, ...Object.values(quests).flat(), ...digest.npcs, ...digest.world, ...met].join(' \u2022 ');
    // The line starts with its date (made for the [Yesterday] tail); the screen shows the date beside it.
    const short = digest.date && digest.line.startsWith(`${digest.date}: `) ? digest.line.slice(digest.date.length + 2) : digest.line;
    return { ...digest, met, short, facts, hasFacts: facts.length > 0, hasHappened: digest.happened.length > 0, hasNpcs: digest.npcs.length > 0, hasWorld: digest.world.length > 0, hasMet: met.length > 0, search };
}

/** `chronicle.dayBoard`: every day digest, newest first, as the Journal lists them (boardDay). */
export function dayBoard(state, _args, tools) {
    const env = setup(state, tools);
    const days = (daysQuery(state, {}, tools) ?? []).reverse().map(boardDay);
    const now = env.now;
    return { days, hasDays: days.length > 0, count: days.length, today: Number.isSafeInteger(now) ? dateText(env.calendar, now) : '' };
}
