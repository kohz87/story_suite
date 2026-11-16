// Story Director v2, chronicle part: building, briefing, capping, and outputting day digests. Pure.

import { bucketDay, trimCats } from '../backlog.js';
import { MAX_MET, MAX_WHO } from './entry-caps.js';
import { cut, flat } from './shared-text.js';
import { isInt } from './shared-values.js';
import { dayLine, fightText, moneyText } from './summary-line.js';
import { MAX_DATE } from './text-caps.js';

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

/** An older day kept short: its date, its line, how many things it held and a compact list of them by kind (`cats`, at most about 1 KB: the Journal's search still reaches it). */
export function briefOf(digest) {
    const cats = trimCats(bucketDay(digest));
    return { day: digest.day, date: digest.date, line: digest.line, brief: true, count: digest.count, made: digest.made, ...(Object.keys(cats).length ? { cats } : {}) };
}

/**
 * The caps on `days` (a `{ [day]: Digest }` map): the newest `full` days stay whole, older ones are
 * kept short, and beyond `keep` the oldest go. → `{ [day]: Digest | null }`: what changes (null: drop).
 */
export function capDays(days, { full, keep }) {
    const order = Object.values(days).sort((a, b) => b.day - a.day);
    const changes = {};
    order.forEach((digest, index) => {
        if (index >= keep) changes[digest.day] = null;
        else if (index >= full && !digest.brief) changes[digest.day] = briefOf(digest);
    });
    return changes;
}

// ---- what the queries give ---------------------------------------------------------------------

/** A digest as the queries give it: a plain copy, with the money in words. */
export function digestOut(digest, { currency = null, substitute = value => value } = {}) {
    const sub = value => flat(substitute(value));
    const base = { day: digest.day, date: digest.date, line: sub(digest.line), brief: digest.brief, count: digest.count, made: digest.made };
    if (digest.brief) {
        return {
            ...base, cats: digest.cats ? JSON.parse(JSON.stringify(digest.cats)) : {}, happened: [], more: 0, places: [], quests: { taken: [], done: [], failed: [], dropped: [] },
            fights: { count: 0, won: 0, lost: 0, fled: 0 }, money: { in: 0, out: 0 }, npcs: [], world: [], met: [], revs: [],
            moneyText: '', fightText: '',
        };
    }
    return {
        ...base,
        happened: digest.happened.map(sub),
        tags: Array.isArray(digest.tags) ? [...digest.tags] : [],
        who: Array.isArray(digest.who) ? digest.who.map(names => [...names]) : [],
        more: digest.more,
        places: [...digest.places],
        quests: { taken: [...digest.quests.taken], done: [...digest.quests.done], failed: [...digest.quests.failed], dropped: [...digest.quests.dropped] },
        fights: { ...digest.fights },
        money: { ...digest.money },
        npcs: [...digest.npcs],
        world: digest.world.map(sub),
        met: Array.isArray(digest.met) ? [...digest.met] : [],
        revs: [...digest.revs],
        moneyText: moneyText(digest.money, currency),
        fightText: fightText(digest.fights),
    };
}
