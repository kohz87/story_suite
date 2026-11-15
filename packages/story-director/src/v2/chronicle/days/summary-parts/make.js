// Story Director v2, chronicle part: the full digest kept for a day, made from its facts. Pure.

import { MAX_DATE, MAX_MET, MAX_WHO, cut, isInt } from '../shared.js';
import { dayLine } from './line.js';

/**
 * The digest kept for a day (full), from its facts. `made`: the receipt revision writing it; `src`:
 * the revisions of the day-facts entries it was made from (it follows them, daysOf), none when it was
 * read from the receipts.
 */
export function makeDigest(day, facts, { date = '', currency = null, made = 0, revs = [], src = null } = {}) {
    const sorted = [...revs].filter(isInt).sort((a, b) => a - b);
    const sources = Array.isArray(src) ? [...new Set(src.filter(isInt))].sort((a, b) => a - b) : [];
    return {
        day,
        date: cut(date, MAX_DATE),
        line: dayLine(date, facts, { currency }),
        brief: false,
        count: facts.count,
        happened: [...facts.happened],
        // Each line's kind, parallel to `happened` (its receipt type, then its thread id); absent when no line has one.
        ...(Array.isArray(facts.tags) && facts.tags.some(Boolean) ? { tags: facts.tags.slice(0, facts.happened.length) } : {}),
        // Who was there at each line, parallel to `happened` (new days only; absent when no line has anyone).
        ...(Array.isArray(facts.who) && facts.who.some(names => names?.length) ? { who: facts.who.slice(0, facts.happened.length).map(names => (Array.isArray(names) ? names.slice(0, MAX_WHO) : [])) } : {}),
        more: facts.more,
        places: [...facts.places],
        quests: { taken: [...facts.quests.taken], done: [...facts.quests.done], failed: [...facts.quests.failed], dropped: [...facts.quests.dropped] },
        fights: { ...facts.fights },
        money: { ...facts.money },
        npcs: [...facts.npcs],
        world: [...facts.world],
        ...(Array.isArray(facts.met) && facts.met.length ? { met: facts.met.slice(0, MAX_MET) } : {}),
        revs: sorted.length ? [sorted[0], sorted.at(-1)] : [],
        made,
        ...(sources.length ? { src: sources } : {}),
    };
}
