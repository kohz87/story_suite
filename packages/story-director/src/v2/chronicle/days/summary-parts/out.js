// Story Director v2, chronicle part: a digest as the queries give it. Pure.

import { flat } from '../shared.js';
import { fightText, moneyText } from './line.js';

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
